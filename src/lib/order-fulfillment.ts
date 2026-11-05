import Razorpay from 'razorpay';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { revealSecret } from '@/lib/secrets';
import { createDraftOrder } from '@/lib/checkout-pricing';
import { calculateFee, planFeePercent } from '@/lib/plans';

const SHOPIFY_REST_VERSION = '2024-01';
const PROCESSING_TIMEOUT_MS = 5 * 60 * 1000;
const UNPAID_CHECK_AFTER_MS = 10 * 60 * 1000;
const UNPAID_CHECK_FOR_MS = 7 * 24 * 60 * 60 * 1000;
const RECONCILE_EVERY_MS = 5 * 60 * 1000;

export const PAID_PAYMENT_STATUSES = ['authorized', 'captured'];

type ShopMerchant = { id: string; shopDomain: string; accessToken: string | null };

type PricingForOrder = {
  paymentMethod: string;
  productTitle: string;
  firstVariantId: string;
  firstPrice: number;
  quantity: number;
  total: number;
  prepaidDiscount: number;
  draftInput: unknown;
  upsell: { id: string; revenue: number } | null;
};

type CustomerForOrder = {
  name?: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
};

export type FulfillmentResult =
  | { status: 'synced'; orderId: string; shopifyOrderId: string | null; orderStatusUrl: string | null }
  | { status: 'busy' | 'failed' | 'total_changed' };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Everything needed to finish this order later, even if the customer has gone.
export function orderDataFromPricing(
  merchant: { id: string; checkoutPlan: string },
  pricing: PricingForOrder,
  customer: CustomerForOrder,
  utm: { source?: string; medium?: string; campaign?: string }
) {
  const feePercent = planFeePercent(merchant.checkoutPlan);
  return {
    merchantId: merchant.id,
    customerName: customer.name,
    customerPhone: customer.phone,
    customerEmail: customer.email,
    address: customer.address,
    city: customer.city,
    state: customer.state,
    pincode: customer.pincode,
    productTitle: pricing.productTitle,
    variantId: pricing.firstVariantId,
    quantity: pricing.quantity,
    price: pricing.firstPrice,
    total: pricing.total,
    paymentMethod: pricing.paymentMethod,
    prepaidDiscount: pricing.prepaidDiscount,
    checkoutPlan: merchant.checkoutPlan,
    feePercent,
    feeAmount: calculateFee(pricing.total, feePercent),
    fulfillmentData: JSON.parse(JSON.stringify({
      draftInput: {
        ...(pricing.draftInput as object),
        tags: [pricing.paymentMethod, 'CheckoutFlow'],
        note: 'Order via CheckoutFlow',
      },
      upsell: pricing.upsell,
    })) as Prisma.InputJsonValue,
    utmSource: utm.source || null,
    utmMedium: utm.medium || null,
    utmCampaign: utm.campaign || null,
  };
}

async function shopifyRest(merchant: ShopMerchant, path: string, method: 'GET' | 'PUT' = 'GET') {
  const res = await fetch(`https://${merchant.shopDomain}/admin/api/${SHOPIFY_REST_VERSION}/${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': revealSecret(merchant.accessToken) ?? '',
    },
  });
  return { ok: res.ok, status: res.status, body: await res.json().catch(() => null) };
}

// Completes the draft. If an earlier attempt already did, this finds that order rather
// than failing or creating another.
async function completeDraft(merchant: ShopMerchant, draftId: string, isPaid: boolean): Promise<string | null> {
  const completed = await shopifyRest(
    merchant,
    `draft_orders/${draftId}/complete.json${isPaid ? '' : '?payment_pending=true'}`,
    'PUT'
  );
  if (completed.ok && completed.body?.draft_order?.order_id) return String(completed.body.draft_order.order_id);

  const existing = await shopifyRest(merchant, `draft_orders/${draftId}.json`);
  if (existing.ok && existing.body?.draft_order?.order_id) return String(existing.body.draft_order.order_id);

  console.error('Shopify Complete Draft Error:', completed.status, JSON.stringify(completed.body));
  return null;
}

// Only one attempt can work on an order at a time, so an order can't be created twice.
async function claimOrder(orderId: string) {
  const claimed = await prisma.order.updateMany({
    where: {
      id: orderId,
      OR: [
        { orderStatus: { in: ['Pending', 'Awaiting_Payment', 'Needs_Attention'] } },
        { orderStatus: 'Processing', updatedAt: { lt: new Date(Date.now() - PROCESSING_TIMEOUT_MS) } },
      ],
    },
    data: { orderStatus: 'Processing' },
  });
  return claimed.count === 1;
}

export async function fulfillOrder(merchant: ShopMerchant, orderId: string, attempts = 1): Promise<FulfillmentResult> {
  if (!(await claimOrder(orderId))) {
    const current = await prisma.order.findUnique({ where: { id: orderId } });
    return current?.orderStatus === 'Synced'
      ? { status: 'synced', orderId, shopifyOrderId: current.shopifyOrderId, orderStatusUrl: current.orderStatusUrl }
      : { status: 'busy' };
  }

  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  const isPaid = Boolean(order.paymentId);
  const saved = order.fulfillmentData as { draftInput: unknown; upsell: { id: string; revenue: number } | null } | null;
  let draftId = order.shopifyDraftOrderId;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (attempt > 1) await sleep(attempt * 1000);
    try {
      if (!draftId) {
        if (!saved?.draftInput) throw new Error(`Order ${orderId} has no saved details to send to Shopify`);
        const draft = await createDraftOrder(
          { ...merchant, accessToken: revealSecret(merchant.accessToken) ?? '', paymentSettings: null },
          saved.draftInput
        );
        if (!draft) continue;

        if (Math.abs(draft.total - order.total) >= 0.01) {
          console.error(`Draft order total ${draft.total} differs from priced total ${order.total} for order ${orderId}`);
          // A COD customer hasn't paid yet, so they can review the new total first.
          if (!isPaid) {
            await prisma.order.update({ where: { id: orderId }, data: { orderStatus: 'Failed' } });
            return { status: 'total_changed' };
          }
        }

        draftId = draft.legacyId;
        await prisma.order.update({ where: { id: orderId }, data: { shopifyDraftOrderId: draftId } });
      }

      const shopifyOrderId = await completeDraft(merchant, draftId, isPaid);
      if (!shopifyOrderId) continue;

      const placed = await shopifyRest(merchant, `orders/${shopifyOrderId}.json`).catch(() => null);
      const orderStatusUrl: string | null = placed?.body?.order?.order_status_url ?? null;

      await prisma.order.update({
        where: { id: orderId },
        data: { shopifyOrderId, orderStatusUrl, orderStatus: 'Synced' },
      });

      if (saved?.upsell) {
        prisma.upsellFunnel.update({
          where: { id: saved.upsell.id },
          data: { conversions: { increment: 1 }, revenue: { increment: saved.upsell.revenue } },
        }).catch(() => {});
      }

      return { status: 'synced', orderId, shopifyOrderId, orderStatusUrl };
    } catch (error) {
      console.error(`Order ${orderId} attempt ${attempt} failed:`, error);
    }
  }

  // A paid order must never be dropped, so it waits for a retry and shows on the dashboard.
  await prisma.order.update({
    where: { id: orderId },
    data: { orderStatus: isPaid ? 'Needs_Attention' : 'Failed' },
  });
  if (isPaid) console.error(`PAID ORDER NOT IN SHOPIFY: order ${orderId}, payment ${order.paymentId}`);
  return { status: 'failed' };
}

// Finds customers who paid but never came back, such as when their phone lost signal
// during the payment, and retries paid orders that Shopify couldn't take.
export async function reconcilePayments(
  merchant: ShopMerchant & { paymentSettings: { razorpayKeyId: string | null; razorpayKeySecret: string | null } | null }
) {
  const now = Date.now();
  const keyId = merchant.paymentSettings?.razorpayKeyId?.trim();
  const keySecret = revealSecret(merchant.paymentSettings?.razorpayKeySecret)?.trim();

  if (keyId && keySecret) {
    const unpaid = await prisma.order.findMany({
      where: {
        merchantId: merchant.id,
        orderStatus: 'Awaiting_Payment',
        paymentId: null,
        razorpayOrderId: { not: null },
        createdAt: { lt: new Date(now - UNPAID_CHECK_AFTER_MS), gt: new Date(now - UNPAID_CHECK_FOR_MS) },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    for (const order of unpaid) {
      try {
        const { items } = await razorpay.orders.fetchPayments(order.razorpayOrderId as string);
        const paid = items.find((payment) =>
          PAID_PAYMENT_STATUSES.includes(payment.status) && Number(payment.amount) >= Math.round(order.total * 100)
        );
        if (!paid) continue;

        await prisma.order.update({ where: { id: order.id }, data: { paymentId: paid.id } });
        await fulfillOrder(merchant, order.id);
      } catch (error) {
        console.error(`Could not check the payment for order ${order.id}:`, error);
      }
    }
  }

  const waiting = await prisma.order.findMany({
    where: {
      merchantId: merchant.id,
      paymentId: { not: null },
      OR: [
        { orderStatus: 'Needs_Attention' },
        { orderStatus: 'Processing', updatedAt: { lt: new Date(now - PROCESSING_TIMEOUT_MS) } },
      ],
    },
    select: { id: true },
    take: 5,
  });
  for (const order of waiting) await fulfillOrder(merchant, order.id);
}

const lastReconciled = new Map<string, number>();

// Runs alongside normal store activity, at most once every few minutes per store.
export function reconcileInBackground(merchant: Parameters<typeof reconcilePayments>[0]) {
  const now = Date.now();
  if (now - (lastReconciled.get(merchant.id) ?? 0) < RECONCILE_EVERY_MS) return;
  lastReconciled.set(merchant.id, now);
  reconcilePayments(merchant).catch((error) => console.error('Reconcile Payments Error:', error));
}
