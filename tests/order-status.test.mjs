// Orders cancelled, refunded, fulfilled or edited in Shopify, and the webhooks that report it.
import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, checkoutSession, createMerchant, db, eventually, merchantCookie, shopifyWebhookHmac, uniquePhone } from './helpers/app.mjs';
import { resetFakeServices, shopify } from './helpers/fake-services.mjs';

beforeEach(() => resetFakeServices());

const WEBHOOK_URI = 'https://checkoutflow.test/api/webhooks/shopify';

let variantCounter = 500000;
const variant = (price) => {
  const id = String(variantCounter++);
  shopify.variants.set(id, { price });
  return id;
};

// Places a real COD order through the app, so it is linked to a Shopify order like a live one.
async function placedOrder({ discounts = [] } = {}) {
  const merchant = await createMerchant({ plan: 'FULL' });
  for (const discount of discounts) await db.discount.create({ data: { merchantId: merchant.id, title: 'Offer', value: 0, ...discount } });
  const phone = uniquePhone();
  const shop = merchant.shopDomain;
  const sessionToken = checkoutSession(shop, phone);
  const items = [{ variantId: variant(500), quantity: 2 }];
  const couponCode = discounts.find((discount) => discount.code)?.code;
  const res = await api('/api/create-order', { body: { shop, sessionToken, items, paymentMethod: 'COD', ...(couponCode ? { appliedCoupon: { code: couponCode } } : {}) } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const order = await db.order.findUnique({ where: { id: res.body.orderId } });
  return { merchant, phone, shop, sessionToken, order, items };
}

let updateClock = Date.parse('2026-11-01T10:00:00Z');
function shopifyOrder(order, changes = {}) {
  updateClock += 60_000;
  return {
    id: Number(order.shopifyOrderId),
    updated_at: new Date(updateClock).toISOString(),
    cancelled_at: null,
    cancel_reason: null,
    financial_status: 'pending',
    fulfillment_status: null,
    current_total_price: order.total.toFixed(2),
    total_price: order.total.toFixed(2),
    refunds: [],
    ...changes,
  };
}

const sendWebhook = (shop, topic, payload, hmac) => {
  const body = JSON.stringify(payload);
  return api('/api/webhooks/shopify', {
    raw: true,
    body,
    headers: { 'Content-Type': 'application/json', 'x-shopify-topic': topic, 'x-shopify-shop-domain': shop, 'x-shopify-hmac-sha256': hmac ?? shopifyWebhookHmac(body) },
  });
};

describe('order changes made in Shopify', () => {
  test('a new popup order starts with Shopify\'s own payment and fulfilment status', async () => {
    const { order } = await placedOrder();
    assert.equal(order.orderStatus, 'Synced');
    assert.equal(order.shopifyFinancialStatus, 'pending');
    assert.equal(order.shopifyFulfillmentStatus, 'unfulfilled');
  });

  test('fulfilment, payment and edits are kept up to date, and the fee follows the new total', async () => {
    const { shop, order } = await placedOrder();
    assert.equal(order.total, 1069);
    assert.equal(order.feeAmount, 21.38);

    const fulfilled = await sendWebhook(shop, 'orders/updated', shopifyOrder(order, { fulfillment_status: 'fulfilled', financial_status: 'paid' }));
    assert.equal(fulfilled.status, 200);
    let saved = await db.order.findUnique({ where: { id: order.id } });
    assert.equal(saved.shopifyFulfillmentStatus, 'fulfilled');
    assert.equal(saved.shopifyFinancialStatus, 'paid');
    assert.equal(saved.orderStatus, 'Synced');

    // The store removed one item from the order in Shopify.
    await sendWebhook(shop, 'orders/updated', shopifyOrder(order, { current_total_price: '569.00', financial_status: 'paid', fulfillment_status: 'fulfilled' }));
    saved = await db.order.findUnique({ where: { id: order.id } });
    assert.equal(saved.total, 569);
    assert.equal(saved.feeAmount, 11.38);
  });

  test('a refund is recorded, and the fee follows what the store keeps', async () => {
    const { shop, order } = await placedOrder();
    await sendWebhook(shop, 'orders/updated', shopifyOrder(order, {
      financial_status: 'partially_refunded',
      current_total_price: '869.00',
      refunds: [{ transactions: [{ kind: 'refund', status: 'success', amount: '200.00' }, { kind: 'refund', status: 'failure', amount: '50.00' }] }],
    }));
    const saved = await db.order.findUnique({ where: { id: order.id } });
    assert.equal(saved.shopifyFinancialStatus, 'partially_refunded');
    assert.equal(saved.refundedAmount, 200);
    assert.equal(saved.total, 869);
    assert.equal(saved.feeAmount, 17.38);
  });

  test('a cancelled order leaves revenue and fees, and its coupon can be used again', async () => {
    const { merchant, shop, order, phone, sessionToken, items } = await placedOrder({
      discounts: [{ code: 'ONCE50', type: 'flat', value: 50, perCustomerLimit: 1, usageLimit: 10 }],
    });
    const discount = await db.discount.findFirst({ where: { merchantId: merchant.id } });
    await eventually(async () => assert.equal((await db.discount.findUnique({ where: { id: discount.id } })).usageCount, 1));
    const blocked = await api('/api/checkout/quote', { body: { shop, sessionToken, items, couponCode: 'ONCE50' } });
    assert.equal(blocked.status, 400, 'used once already');

    // Shopify sends both topics for a cancellation, in either order.
    const cancelled = shopifyOrder(order, { cancelled_at: '2026-11-01T12:00:00+05:30', cancel_reason: 'customer', financial_status: 'voided' });
    assert.equal((await sendWebhook(shop, 'orders/cancelled', cancelled)).status, 200);
    assert.equal((await sendWebhook(shop, 'orders/updated', cancelled)).status, 200);

    const saved = await db.order.findUnique({ where: { id: order.id } });
    assert.equal(saved.orderStatus, 'Cancelled');
    assert.equal(saved.cancelReason, 'customer');
    assert.equal(saved.cancelledAt.toISOString(), '2026-11-01T06:30:00.000Z');
    assert.equal(saved.feeAmount, 0);
    assert.equal(saved.shopifyFinancialStatus, 'voided');

    assert.equal((await db.discount.findUnique({ where: { id: discount.id } })).usageCount, 0, 'given back once');
    assert.equal(await db.discountRedemption.count({ where: { discountId: discount.id, phone } }), 0);
    const again = await api('/api/checkout/quote', { body: { shop, sessionToken, items, couponCode: 'ONCE50' } });
    assert.equal(again.status, 200);

    // Dashboard totals only count orders that weren't cancelled.
    const fees = await db.order.aggregate({ where: { merchantId: merchant.id, orderStatus: 'Synced' }, _sum: { feeAmount: true }, _count: true });
    assert.equal(fees._count, 0);

    // A cancelled order is never placed in Shopify again.
    await db.order.update({ where: { id: order.id }, data: { paymentId: 'pay_x' } });
    const completesBefore = shopify.callsOf('completeDraft', shop).length;
    const retry = await api('/api/orders/retry', { cookie: merchantCookie(shop), body: { id: order.id } });
    assert.notEqual(retry.status, 200);
    assert.equal(shopify.callsOf('completeDraft', shop).length, completesBefore);
    assert.equal((await db.order.findUnique({ where: { id: order.id } })).orderStatus, 'Cancelled');
  });

  test('an older update arriving late doesn\'t undo a newer one', async () => {
    const { shop, order } = await placedOrder();
    const older = shopifyOrder(order, { fulfillment_status: null });
    const newer = shopifyOrder(order, { fulfillment_status: 'fulfilled' });
    await sendWebhook(shop, 'orders/updated', newer);
    await sendWebhook(shop, 'orders/updated', older);
    await sendWebhook(shop, 'orders/updated', newer);
    const saved = await db.order.findUnique({ where: { id: order.id } });
    assert.equal(saved.shopifyFulfillmentStatus, 'fulfilled');
    assert.equal(saved.shopifyUpdatedAt.toISOString(), newer.updated_at);
  });

  test('forged webhooks, unknown orders and other stores\' orders change nothing', async () => {
    const { shop, order } = await placedOrder();
    const other = await createMerchant();
    const cancel = shopifyOrder(order, { cancelled_at: '2026-11-01T12:00:00Z' });

    assert.equal((await sendWebhook(shop, 'orders/cancelled', cancel, shopifyWebhookHmac('{}'))).status, 401);
    assert.equal((await sendWebhook(other.shopDomain, 'orders/cancelled', cancel)).status, 200, 'same Shopify ID, but another store');
    assert.equal((await sendWebhook(shop, 'orders/updated', { ...cancel, id: 999999999 })).status, 200);
    assert.equal((await sendWebhook('nobody.myshopify.com', 'orders/updated', cancel)).status, 200);
    assert.equal((await db.order.findUnique({ where: { id: order.id } })).orderStatus, 'Synced');
  });

  test('orders recorded from Shopify checkout are updated too', async () => {
    const merchant = await createMerchant({ plan: 'OTP_ONLY' });
    const created = { id: 777000111, current_total_price: '1000.00', note_attributes: [{ name: '_checkoutflow_plan', value: 'OTP_ONLY' }], line_items: [{ title: 'Tee', variant_id: 1, price: '1000.00', quantity: 1 }] };
    await sendWebhook(merchant.shopDomain, 'orders/create', created);
    const order = await db.order.findFirst({ where: { merchantId: merchant.id } });
    assert.equal(order.feeAmount, 5);
    await sendWebhook(merchant.shopDomain, 'orders/cancelled', shopifyOrder(order, { cancelled_at: '2026-11-01T12:00:00Z' }));
    const saved = await db.order.findUnique({ where: { id: order.id } });
    assert.equal(saved.orderStatus, 'Cancelled');
    assert.equal(saved.feeAmount, 0);
  });
});

describe('registering the order webhooks', () => {
  test('a store visiting the dashboard is subscribed once, without duplicates', async () => {
    const merchant = await createMerchant();
    const shop = merchant.shopDomain;
    shopify.webhooks.set(shop, [{ id: 'gid://shopify/WebhookSubscription/1', topic: 'ORDERS_UPDATED', uri: WEBHOOK_URI }]);

    await api('/api/settings/plan', { cookie: merchantCookie(shop), body: { plan: 'FULL' } });
    await eventually(() => assert.equal(shopify.webhooks.get(shop).length, 2));
    assert.deepEqual(shopify.webhooks.get(shop).map((hook) => [hook.topic, hook.uri]).sort(), [['ORDERS_CANCELLED', WEBHOOK_URI], ['ORDERS_UPDATED', WEBHOOK_URI]]);
    const created = shopify.callsOf('webhookCreate', shop);
    assert.equal(created.length, 1);
    assert.deepEqual(created[0].variables, { topic: 'ORDERS_CANCELLED', webhookSubscription: { uri: WEBHOOK_URI, format: 'JSON' } });
    assert.equal(created[0].token, 'shpat_test_token');

    // Later visits don't ask Shopify again for a while.
    await api('/api/settings/plan', { cookie: merchantCookie(shop), body: { plan: 'FULL' } });
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(shopify.callsOf('webhookList', shop).length, 1);
  });

  test('a store is subscribed when it logs in', async () => {
    const shop = `login-hooks-${Date.now()}.myshopify.com`;
    const start = await api(`/api/auth/shopify?shop=${shop}`, { method: 'GET' });
    const state = new URL(start.headers.get('location')).searchParams.get('state');
    const params = { code: 'c', shop, state, timestamp: '1700000000' };
    const crypto = await import('node:crypto');
    const message = Object.keys(params).sort().map((key) => `${key}=${params[key]}`).join('&');
    const hmac = crypto.createHmac('sha256', 'test-client-secret-not-real').update(message).digest('hex');
    const done = await api(`/api/auth/callback?${new URLSearchParams({ ...params, hmac })}`, { method: 'GET', cookie: `shopify_oauth_state=${state}` });
    assert.equal(done.headers.get('location'), '/');
    await eventually(() => assert.equal(shopify.webhooks.get(shop)?.length, 2));
    assert.ok(shopify.callsOf('webhookCreate', shop).every((call) => call.token === `shpat_${shop.split('.')[0]}`));
  });
});
