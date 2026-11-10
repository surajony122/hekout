import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { calculateFee, isCheckoutPlan, planFeePercent } from '@/lib/plans';
import { PLAN_ATTRIBUTE } from '@/lib/shopify-checkout';
import { applyShopifyOrderUpdate } from '@/lib/shopify-order-sync';

const ORDER_CHANGE_TOPICS = ['orders/updated', 'orders/cancelled'];

function isFromShopify(rawBody: string, signature: string | null) {
  const secret = process.env.SHOPIFY_CLIENT_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest();
  const received = Buffer.from(signature, 'base64');
  return received.length === expected.length && crypto.timingSafeEqual(expected, received);
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!isFromShopify(rawBody, request.headers.get('x-shopify-hmac-sha256'))) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const topic = request.headers.get('x-shopify-topic') ?? '';

  // Cancellations, refunds, fulfilment and edits made in Shopify.
  if (ORDER_CHANGE_TOPICS.includes(topic)) {
    try {
      const merchant = await prisma.merchant.findUnique({
        where: { shopDomain: request.headers.get('x-shopify-shop-domain') ?? '' },
      });
      if (merchant) await applyShopifyOrderUpdate(merchant.id, JSON.parse(rawBody));
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Shopify Order Update Webhook Error:', error);
      return NextResponse.json({ error: 'Could not update the order' }, { status: 500 });
    }
  }

  // Anything else must still get a 200, or Shopify keeps retrying it.
  if (topic !== 'orders/create') {
    return NextResponse.json({ success: true });
  }

  try {
    const order = JSON.parse(rawBody);
    // Only carts we sent to Shopify checkout carry this mark.
    const plan = Array.isArray(order.note_attributes)
      ? order.note_attributes.find((attribute: { name?: string }) => attribute.name === PLAN_ATTRIBUTE)?.value
      : null;
    if (!isCheckoutPlan(plan)) return NextResponse.json({ success: true });

    const merchant = await prisma.merchant.findUnique({
      where: { shopDomain: request.headers.get('x-shopify-shop-domain') ?? '' },
    });
    if (!merchant) return NextResponse.json({ success: true });

    // Shopify can send the same order twice, and it should only be counted once.
    const shopifyOrderId = String(order.id);
    const existing = await prisma.order.findFirst({ where: { merchantId: merchant.id, shopifyOrderId } });
    if (existing) return NextResponse.json({ success: true });

    const total = parseFloat(order.current_total_price ?? order.total_price) || 0;
    const firstItem = order.line_items?.[0];
    const customer = order.customer;
    const feePercent = planFeePercent(plan);

    await prisma.order.create({
      data: {
        merchantId: merchant.id,
        shopifyOrderId,
        customerName: [customer?.first_name, customer?.last_name].filter(Boolean).join(' ') || null,
        customerPhone: order.phone ?? customer?.phone ?? null,
        customerEmail: order.email ?? customer?.email ?? null,
        productTitle: firstItem?.title ?? null,
        variantId: firstItem?.variant_id ? String(firstItem.variant_id) : null,
        quantity: Array.isArray(order.line_items)
          ? order.line_items.reduce((sum: number, item: { quantity?: number }) => sum + (item.quantity ?? 0), 0)
          : 1,
        price: parseFloat(firstItem?.price) || 0,
        total,
        paymentMethod: order.payment_gateway_names?.[0] ?? 'Shopify checkout',
        orderStatusUrl: order.order_status_url ?? null,
        orderStatus: 'Synced',
        checkoutPlan: plan,
        feePercent,
        feeAmount: calculateFee(total, feePercent),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Shopify Webhook Error:', error);
    return NextResponse.json({ error: 'Could not save the order' }, { status: 500 });
  }
}
