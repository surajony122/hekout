import { prisma } from '@/lib/prisma';
import { calculateFee } from '@/lib/plans';
import { revealSecret } from '@/lib/secrets';

const API_VERSION = '2026-07';

// The parts of Shopify's order webhook (orders/updated, orders/cancelled) that we keep.
type ShopifyOrderPayload = {
  id?: number | string;
  updated_at?: string;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
  financial_status?: string | null;
  fulfillment_status?: string | null;
  current_total_price?: string;
  total_price?: string;
  refunds?: { transactions?: { kind?: string; status?: string; amount?: string }[] }[];
};

const roundMoney = (value: number) => Math.round(value * 100) / 100;

function refundedOf(payload: ShopifyOrderPayload) {
  const total = (payload.refunds ?? [])
    .flatMap((refund) => refund.transactions ?? [])
    .filter((transaction) => transaction.kind === 'refund' && transaction.status === 'success')
    .reduce((sum, transaction) => sum + (parseFloat(transaction.amount ?? '0') || 0), 0);
  return roundMoney(total);
}

// Gives back the uses of an order's offers, so a cancelled order doesn't block the customer.
async function releaseRedemptions(orderId: string) {
  const redemptions = await prisma.discountRedemption.findMany({ where: { orderId } });
  for (const redemption of redemptions) {
    const removed = await prisma.discountRedemption.deleteMany({ where: { id: redemption.id } });
    if (removed.count > 0) {
      await prisma.discount.updateMany({
        where: { id: redemption.discountId, usageCount: { gt: 0 } },
        data: { usageCount: { decrement: 1 } },
      });
    }
  }
}

export type SyncResult = 'updated' | 'unknown_order' | 'stale';

// Brings our copy of an order in line with Shopify. Cancelled orders leave revenue and fees,
// and an edited or refunded order's fee follows what the store actually keeps.
export async function applyShopifyOrderUpdate(merchantId: string, payload: ShopifyOrderPayload): Promise<SyncResult> {
  if (payload.id === undefined || payload.id === null) return 'unknown_order';
  const order = await prisma.order.findFirst({ where: { merchantId, shopifyOrderId: String(payload.id) } });
  if (!order) return 'unknown_order';

  // Shopify can deliver webhooks out of order, so an older update never replaces a newer one.
  const updatedAt = payload.updated_at ? new Date(payload.updated_at) : new Date();
  if (Number.isNaN(updatedAt.getTime())) return 'stale';

  const cancelled = Boolean(payload.cancelled_at);
  // Shopify's current total already reflects edits, removed items and returns.
  const currentTotal = parseFloat(payload.current_total_price ?? payload.total_price ?? '');
  const total = Number.isFinite(currentTotal) ? roundMoney(currentTotal) : order.total;
  const wasCancelled = order.orderStatus === 'Cancelled';

  const saved = await prisma.order.updateMany({
    where: {
      id: order.id,
      OR: [{ shopifyUpdatedAt: null }, { shopifyUpdatedAt: { lt: updatedAt } }],
    },
    data: {
      shopifyUpdatedAt: updatedAt,
      shopifyFinancialStatus: payload.financial_status ?? order.shopifyFinancialStatus,
      shopifyFulfillmentStatus: payload.fulfillment_status ?? 'unfulfilled',
      cancelledAt: cancelled ? new Date(payload.cancelled_at as string) : null,
      cancelReason: cancelled ? payload.cancel_reason ?? null : null,
      refundedAmount: refundedOf(payload),
      total,
      feeAmount: cancelled ? 0 : calculateFee(total, order.feePercent),
      ...(cancelled ? { orderStatus: 'Cancelled' } : {}),
    },
  });
  if (saved.count === 0) return 'stale';

  if (cancelled && !wasCancelled) await releaseRedemptions(order.id);
  return 'updated';
}

// --- Webhook subscriptions ---

const ORDER_TOPICS = ['ORDERS_UPDATED', 'ORDERS_CANCELLED'] as const;
const CHECK_EVERY_MS = 12 * 60 * 60 * 1000;
const checked = new Map<string, number>();

const EXISTING_WEBHOOKS = `query ExistingWebhooks($topics: [WebhookSubscriptionTopic!]) {
  webhookSubscriptions(first: 50, topics: $topics) {
    nodes { id topic uri }
  }
}`;

const CREATE_WEBHOOK = `mutation CreateWebhook($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
  webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
    webhookSubscription { id topic uri }
    userErrors { field message }
  }
}`;

// Where Shopify sends webhooks: the public site, which the login callback address already names.
export function webhookUri(): string | null {
  const redirect = process.env.SHOPIFY_REDIRECT_URI;
  const base = redirect ? new URL(redirect).origin : process.env.HOST;
  return base && base.startsWith('https://') ? `${base}/api/webhooks/shopify` : null;
}

async function adminGraphql(shopDomain: string, accessToken: string, query: string, variables: unknown) {
  const res = await fetch(`https://${shopDomain}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': accessToken },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(5000),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.data || body.errors) {
    throw new Error(`Shopify Admin API error ${res.status}: ${JSON.stringify(body?.errors ?? null)}`);
  }
  return body.data;
}

// Makes sure Shopify tells us when this store's orders change. Safe to call often: it only
// asks Shopify every few hours per store, and only adds what is missing.
export async function ensureOrderWebhooks(merchant: { shopDomain: string; accessToken: string | null }) {
  const uri = webhookUri();
  const accessToken = revealSecret(merchant.accessToken);
  if (!uri || !accessToken) return [];

  const key = `${merchant.shopDomain}|${merchant.accessToken}`;
  if ((checked.get(key) ?? 0) > Date.now()) return [];
  checked.set(key, Date.now() + CHECK_EVERY_MS);

  try {
    const data = await adminGraphql(merchant.shopDomain, accessToken, EXISTING_WEBHOOKS, { topics: ORDER_TOPICS });
    const existing: { topic: string; uri: string }[] = data.webhookSubscriptions.nodes;
    const missing = ORDER_TOPICS.filter((topic) => !existing.some((hook) => hook.topic === topic && hook.uri === uri));

    for (const topic of missing) {
      const created = await adminGraphql(merchant.shopDomain, accessToken, CREATE_WEBHOOK, { topic, webhookSubscription: { uri, format: 'JSON' } });
      const errors = created.webhookSubscriptionCreate.userErrors;
      if (errors.length > 0) throw new Error(`Could not add ${topic} webhook: ${JSON.stringify(errors)}`);
    }
    return missing;
  } catch (error) {
    // Try again on the next visit rather than in 12 hours.
    checked.delete(key);
    console.error(`Order webhooks for ${merchant.shopDomain}:`, error);
    return [];
  }
}
