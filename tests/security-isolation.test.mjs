// One store's login must never read or change another store's settings or orders.
import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, createMerchant, db, merchantCookie } from './helpers/app.mjs';
import { resetFakeServices as resetFakes } from './helpers/fake-services.mjs';

beforeEach(() => resetFakes());

async function twoStores() {
  const mine = await createMerchant({ payment: { codFeeAmount: 50 } });
  const theirs = await createMerchant({
    payment: { codFeeAmount: 69, razorpayKeyId: 'rzp_test_theirs', razorpayKeySecret: 'theirs-secret' },
    widget: { primaryColor: '#ff0000' },
  });
  const theirDiscount = await db.discount.create({ data: { merchantId: theirs.id, code: 'THEIRS10', title: 'Theirs', type: 'percentage', value: 10 } });
  const theirRule = await db.shippingRule.create({ data: { merchantId: theirs.id, name: 'Theirs', fee: 40 } });
  const theirOrder = await db.order.create({ data: { merchantId: theirs.id, total: 500, paymentId: 'pay_theirs', orderStatus: 'Needs_Attention' } });
  return { mine, theirs, theirDiscount, theirRule, theirOrder, cookie: merchantCookie(mine.shopDomain) };
}

const unchanged = async (model, row) => assert.deepEqual(await db[model].findUnique({ where: { id: row.id } }), row);

describe('cross-store isolation on /api/settings/*', () => {
  test('discounts: another store\'s rule can\'t be edited or deleted by its id', async () => {
    const { mine, theirDiscount, cookie } = await twoStores();
    const edit = await api('/api/settings/discounts', {
      cookie,
      body: { id: theirDiscount.id, type: 'percentage', title: 'Hijacked', code: 'THEIRS10', value: 99 },
    });
    assert.equal(edit.status, 404);
    const remove = await api('/api/settings/discounts', { method: 'DELETE', cookie, body: { id: theirDiscount.id } });
    assert.equal(remove.status, 404);
    await unchanged('discount', theirDiscount);

    // The same code is fine in my own store, since codes belong to one store.
    const mineToo = await api('/api/settings/discounts', { cookie, body: { type: 'flat', title: 'Mine', code: 'THEIRS10', value: 20 } });
    assert.equal(mineToo.status, 200);
    const created = await db.discount.findUnique({ where: { id: mineToo.body.id } });
    assert.equal(created.merchantId, mine.id);
  });

  test('shipping rules: another store\'s rule can\'t be edited or deleted by its id', async () => {
    const { mine, theirRule, cookie } = await twoStores();
    const edit = await api('/api/settings/shipping-rules', { cookie, body: { id: theirRule.id, name: 'Hijacked', fee: 0 } });
    assert.equal(edit.status, 404);
    const remove = await api('/api/settings/shipping-rules', { method: 'DELETE', cookie, body: { id: theirRule.id } });
    assert.equal(remove.status, 404);
    await unchanged('shippingRule', theirRule);

    const own = await api('/api/settings/shipping-rules', { cookie, body: { name: 'Mine', fee: 30, merchantId: theirRule.merchantId } });
    assert.equal(own.status, 200);
    assert.equal((await db.shippingRule.findUnique({ where: { id: own.body.id } })).merchantId, mine.id);
  });

  test('payments, shipping, widget and plan only ever change the logged-in store', async () => {
    const { mine, theirs, cookie } = await twoStores();
    const theirSettings = await db.paymentSettings.findUnique({ where: { merchantId: theirs.id } });
    const theirWidget = await db.widgetSettings.findUnique({ where: { merchantId: theirs.id } });
    const sneaky = { merchantId: theirs.id, shop: theirs.shopDomain, shopDomain: theirs.shopDomain, id: theirs.id };

    const calls = [
      ['/api/settings/payments', { ...sneaky, razorpayKeyId: 'rzp_test_mine', razorpayKeySecret: 'mine-secret', codFeeAmount: 10, isCodFeeEnabled: true }],
      ['/api/settings/shipping', { ...sneaky, isShippingFeeEnabled: true, shippingFeeAmount: 25, freeShippingThreshold: 500 }],
      ['/api/settings/widget', { ...sneaky, primaryColor: '#00ff00', storeName: 'Mine' }],
      ['/api/settings/plan', { ...sneaky, plan: 'OTP_COD' }],
    ];
    for (const [route, body] of calls) {
      const res = await api(route, { cookie, body });
      assert.equal(res.status, 200, route);
    }

    await unchanged('paymentSettings', theirSettings);
    await unchanged('widgetSettings', theirWidget);
    const theirsNow = await db.merchant.findUnique({ where: { id: theirs.id } });
    assert.equal(theirsNow.checkoutPlan, 'FULL');
    assert.equal(theirsNow.storeName, null);

    const minePayment = await db.paymentSettings.findUnique({ where: { merchantId: mine.id } });
    assert.equal(minePayment.razorpayKeyId, 'rzp_test_mine');
    assert.ok(minePayment.razorpayKeySecret.startsWith('enc:v1:'), 'the Razorpay secret is stored encrypted');
    assert.equal(minePayment.shippingFeeAmount, 25);
    assert.equal((await db.widgetSettings.findUnique({ where: { merchantId: mine.id } })).primaryColor, '#00ff00');
    assert.equal((await db.merchant.findUnique({ where: { id: mine.id } })).checkoutPlan, 'OTP_COD');
  });

  test('every settings route refuses requests without a login', async () => {
    const routes = ['discounts', 'payments', 'plan', 'shipping-rules', 'shipping', 'widget'];
    for (const route of routes) {
      const res = await api(`/api/settings/${route}`, { body: {} });
      assert.equal(res.status, 401, route);
    }
    for (const route of ['discounts', 'shipping-rules']) {
      const res = await api(`/api/settings/${route}`, { method: 'DELETE', body: { id: 'x' } });
      assert.equal(res.status, 401, route);
    }
  });

  test('another store\'s paid order can\'t be retried', async () => {
    const { theirOrder, cookie } = await twoStores();
    const res = await api('/api/orders/retry', { cookie, body: { id: theirOrder.id } });
    assert.equal(res.status, 404);
    await unchanged('order', theirOrder);
  });

  test('the widget config never shows saved secrets or hidden offers', async () => {
    const { theirs } = await twoStores();
    await db.discount.create({ data: { merchantId: theirs.id, code: 'SHOWN', title: 'Shown', type: 'flat', value: 5, showInCheckout: true, usageLimit: 5, perCustomerLimit: 1 } });
    await db.discount.create({ data: { merchantId: theirs.id, code: 'USEDUP', title: 'Used up', type: 'flat', value: 5, showInCheckout: true, usageLimit: 1, usageCount: 1 } });
    await db.discount.create({ data: { merchantId: theirs.id, code: 'ENDED', title: 'Ended', type: 'flat', value: 5, showInCheckout: true, endsAt: new Date(Date.now() - 1000) } });
    await db.discount.create({ data: { merchantId: theirs.id, code: 'SOON', title: 'Soon', type: 'flat', value: 5, showInCheckout: true, startsAt: new Date(Date.now() + 86400000) } });
    await db.discount.create({ data: { merchantId: theirs.id, code: 'OFF', title: 'Off', type: 'flat', value: 5, showInCheckout: true, isActive: false } });

    const res = await api(`/api/widget/config?shop=${theirs.shopDomain}`, { method: 'GET' });
    assert.equal(res.status, 200);
    assert.ok(!res.text.includes('theirs-secret'));
    assert.ok(!res.text.includes('shpat_'));
    assert.deepEqual(res.body.config.offers, [{ code: 'SHOWN', title: 'Shown', description: null }]);
    assert.equal(res.body.config.hasRazorpay, true);
  });
});
