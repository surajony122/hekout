// Placing orders: COD, prepaid and Partial COD through Razorpay, retries, and offers
// counted once. Also the OTP Verify plan's hand-off to Shopify checkout.
import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  api, checkoutSession, createMerchant, db, eventually, merchantCookie, razorpaySignature, uniquePhone,
} from './helpers/app.mjs';
import { razorpay, resetFakeServices, shopify } from './helpers/fake-services.mjs';

beforeEach(() => resetFakeServices());

const KEY_ID = 'rzp_test_key';
const KEY_SECRET = 'rzp-test-secret-not-real';

let variantCounter = 200000;
const variant = (price) => {
  const id = String(variantCounter++);
  shopify.variants.set(id, { price });
  return id;
};

async function store({ plan = 'FULL', payment = {}, discounts = [] } = {}) {
  const merchant = await createMerchant({ plan, payment: { razorpayKeyId: KEY_ID, razorpayKeySecret: KEY_SECRET, ...payment } });
  for (const discount of discounts) {
    await db.discount.create({ data: { merchantId: merchant.id, code: '', title: 'Offer', value: 0, ...discount } });
  }
  const phone = uniquePhone();
  const shop = merchant.shopDomain;
  const sessionToken = checkoutSession(shop, phone);
  const customer = { customerName: 'Asha Kumar', customerEmail: 'asha@example.com', address: '12 MG Road', city: 'Pune', state: 'Maharashtra', pincode: '411001' };
  const items = [{ variantId: variant(500), quantity: 2, title: 'Tee' }];
  const quote = async (extra = {}) => (await api('/api/checkout/quote', { body: { shop, sessionToken, items, ...customer, ...extra } })).body;
  const order = (body) => api('/api/create-order', { body: { shop, sessionToken, items, ...customer, ...body } });
  const startPayment = (body) => api('/api/checkout/create-razorpay-order', { body: { shop, sessionToken, items, ...customer, ...body } });
  // What the widget sends after Razorpay's checkout succeeds.
  const pay = (razorpayOrderId, amount, extra = {}) => {
    const payment = razorpay.addPayment({ order_id: razorpayOrderId, amount, ...extra });
    return {
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: payment.id,
      razorpay_signature: razorpaySignature(KEY_SECRET, razorpayOrderId, payment.id),
    };
  };
  return { merchant, phone, shop, sessionToken, items, quote, order, startPayment, pay };
}

const ordersOf = (merchant) => db.order.findMany({ where: { merchantId: merchant.id }, orderBy: { createdAt: 'asc' } });
const completes = (shop) => shopify.callsOf('completeDraft', shop);

describe('Cash on Delivery', () => {
  test('a COD order is created from the signed quote and left unpaid in Shopify', async () => {
    const { merchant, shop, quote, order, phone } = await store();
    const { cod } = await quote();
    const calculationsBefore = shopify.callsOf('draftOrderCalculate', shop).length;

    const res = await order({ paymentMethod: 'COD', quoteToken: cod.quoteToken, expectedTotal: cod.total });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.success, true);
    assert.match(res.body.orderStatusUrl, /\/orders\/\d+\/status$/);
    assert.equal(shopify.callsOf('draftOrderCalculate', shop).length, calculationsBefore, 'the quote is reused, not priced again');

    const [saved] = await ordersOf(merchant);
    assert.equal(saved.orderStatus, 'Synced');
    assert.equal(saved.paymentMethod, 'COD');
    assert.equal(saved.customerPhone, phone);
    assert.equal(saved.total, 1069);
    assert.equal(saved.feePercent, 2);
    assert.equal(saved.feeAmount, 21.38);
    assert.equal(saved.paymentId, null);
    assert.equal(saved.shopifyOrderId, res.body.shopifyOrderId);

    const [complete] = completes(shop);
    assert.equal(complete.paymentPending, true);
    const draft = shopify.callsOf('draftOrderCreate', shop)[0].variables.input;
    assert.deepEqual(draft.tags, ['COD', 'CheckoutFlow']);
    assert.equal(draft.shippingLine.title, 'Cash on Delivery Fee');
    assert.equal(draft.shippingAddress.address1, '12 MG Road');
    assert.equal(draft.phone, `+91${phone}`);

    const profile = await eventually(async () => {
      const found = await db.customerProfile.findFirst({ where: { merchantId: merchant.id, phone } });
      assert.ok(found);
      return found;
    });
    assert.equal(profile.city, 'Pune');
  });

  test('without a quote, the order is priced again on the server', async () => {
    const { merchant, shop, order } = await store();
    const res = await order({ paymentMethod: 'COD', expectedTotal: 1069 });
    assert.equal(res.status, 200);
    assert.ok(shopify.callsOf('draftOrderCalculate', shop).length > 0);
    assert.equal((await ordersOf(merchant))[0].total, 1069);
  });

  test('a total that changed since the customer saw it stops the order', async () => {
    const { merchant, order } = await store();
    const res = await order({ paymentMethod: 'COD', expectedTotal: 999 });
    assert.equal(res.status, 409);
    assert.equal(res.body.code, 'TOTAL_CHANGED');
    assert.equal((await ordersOf(merchant)).length, 0);
  });

  test('if Shopify\'s draft comes out at a different total, the COD customer is asked to review it', async () => {
    const { merchant, quote, order } = await store();
    const { cod } = await quote();
    shopify.priceChangeOnCreate = 50;
    const res = await order({ paymentMethod: 'COD', quoteToken: cod.quoteToken, expectedTotal: cod.total });
    assert.equal(res.status, 409);
    assert.equal(res.body.code, 'TOTAL_CHANGED');
    assert.equal((await ordersOf(merchant))[0].orderStatus, 'Failed');
  });

  test('a Shopify hiccup is retried once', async () => {
    const { merchant, shop, order } = await store();
    shopify.failCompletes = 1;
    const res = await order({ paymentMethod: 'COD' });
    assert.equal(res.status, 200);
    assert.equal(completes(shop).length, 2);
    assert.equal(shopify.callsOf('draftOrderCreate', shop).length, 1, 'the same draft is completed, not a second one');
    assert.equal((await ordersOf(merchant))[0].orderStatus, 'Synced');
  });

  test('if Shopify keeps failing, the COD order is marked failed and the customer can try again', async () => {
    const { merchant, order } = await store();
    shopify.failCompletes = 5;
    const res = await order({ paymentMethod: 'COD' });
    assert.equal(res.status, 500);
    assert.equal((await ordersOf(merchant))[0].orderStatus, 'Failed');
  });

  test('online payment methods need a Razorpay payment', async () => {
    const { merchant, order } = await store();
    const res = await order({ paymentMethod: 'PREPAID' });
    assert.equal(res.status, 402);
    assert.equal((await ordersOf(merchant)).length, 0);
  });
});

describe('prepaid through Razorpay', () => {
  test('payment is saved before paying, verified with Razorpay, and the order is marked paid', async () => {
    const { merchant, shop, quote, startPayment, order, pay } = await store({ payment: { isPrepaidDiscountEnabled: true, prepaidDiscountType: 'flat', prepaidDiscountValue: 100 } });
    const { prepaid } = await quote();
    assert.equal(prepaid.total, 900);

    const started = await startPayment({ paymentMethod: 'PREPAID', quoteToken: prepaid.quoteToken, expectedTotal: prepaid.total });
    assert.equal(started.status, 200);
    assert.equal(started.body.amount, 90000);
    assert.equal(started.body.keyId, KEY_ID);
    assert.equal(razorpay.calls[0].keyId, KEY_ID);
    const [waiting] = await ordersOf(merchant);
    assert.equal(waiting.orderStatus, 'Awaiting_Payment');
    assert.equal(waiting.razorpayOrderId, started.body.orderId);

    const proof = pay(started.body.orderId, 90000);
    const res = await order({ paymentMethod: 'PREPAID', quoteToken: prepaid.quoteToken, expectedTotal: prepaid.total, ...proof });
    assert.equal(res.status, 200, JSON.stringify(res.body));

    const orders = await ordersOf(merchant);
    assert.equal(orders.length, 1, 'the saved record becomes the order');
    assert.equal(orders[0].paymentId, proof.razorpay_payment_id);
    assert.equal(orders[0].orderStatus, 'Synced');
    assert.equal(orders[0].prepaidDiscount, 100);
    assert.equal(completes(shop)[0].paymentPending, false);
  });

  test('sending the same paid order twice places it once', async () => {
    const { merchant, shop, quote, startPayment, order, pay } = await store();
    const { prepaid } = await quote();
    const started = await startPayment({ paymentMethod: 'PREPAID', quoteToken: prepaid.quoteToken });
    const proof = pay(started.body.orderId, started.body.amount);
    const body = { paymentMethod: 'PREPAID', quoteToken: prepaid.quoteToken, ...proof };

    const first = await order(body);
    const second = await order(body);
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(second.body.shopifyOrderId, first.body.shopifyOrderId);
    assert.equal((await ordersOf(merchant)).length, 1);
    assert.equal(shopify.callsOf('draftOrderCreate', shop).length, 1);
  });

  test('a forged signature, an unpaid or short payment, or another order\'s payment is refused', async () => {
    const { merchant, quote, startPayment, order, pay } = await store();
    const { prepaid } = await quote();
    const started = await startPayment({ paymentMethod: 'PREPAID', quoteToken: prepaid.quoteToken });
    const other = await startPayment({ paymentMethod: 'PREPAID', quoteToken: prepaid.quoteToken });
    const base = { paymentMethod: 'PREPAID', quoteToken: prepaid.quoteToken };

    const forged = pay(started.body.orderId, started.body.amount);
    forged.razorpay_signature = razorpaySignature('wrong-secret', started.body.orderId, forged.razorpay_payment_id);
    assert.equal((await order({ ...base, ...forged })).status, 402, 'forged signature');

    assert.equal((await order({ ...base, ...pay(started.body.orderId, started.body.amount, { status: 'failed' }) })).status, 402, 'failed payment');
    assert.equal((await order({ ...base, ...pay(started.body.orderId, started.body.amount - 100) })).status, 402, 'paid too little');

    const otherPayment = pay(other.body.orderId, other.body.amount);
    const mixed = { ...otherPayment, razorpay_order_id: started.body.orderId, razorpay_signature: razorpaySignature(KEY_SECRET, started.body.orderId, otherPayment.razorpay_payment_id) };
    assert.equal((await order({ ...base, ...mixed })).status, 402, 'payment belongs to another Razorpay order');

    const orders = await ordersOf(merchant);
    assert.ok(orders.every((saved) => saved.orderStatus === 'Awaiting_Payment' && saved.paymentId === null));
  });

  test('one payment can\'t pay for a second customer\'s order', async () => {
    const { merchant, shop, items, quote, startPayment, order, pay } = await store();
    const { prepaid } = await quote();
    const started = await startPayment({ paymentMethod: 'PREPAID', quoteToken: prepaid.quoteToken });
    const proof = pay(started.body.orderId, started.body.amount);
    assert.equal((await order({ paymentMethod: 'PREPAID', ...proof })).status, 200);

    const replay = await api('/api/create-order', {
      body: { shop, sessionToken: checkoutSession(shop, uniquePhone()), items, paymentMethod: 'PREPAID', ...proof },
    });
    assert.equal(replay.status, 409);
    assert.equal((await ordersOf(merchant)).filter((saved) => saved.paymentId).length, 1);
  });

  test('if Shopify is down, a paid order is kept, the customer isn\'t asked to pay again, and it can be retried', async () => {
    const { merchant, quote, startPayment, order, pay } = await store();
    const { prepaid } = await quote();
    const started = await startPayment({ paymentMethod: 'PREPAID', quoteToken: prepaid.quoteToken });
    shopify.failCompletes = 3;
    const res = await order({ paymentMethod: 'PREPAID', quoteToken: prepaid.quoteToken, ...pay(started.body.orderId, started.body.amount) });
    assert.equal(res.status, 202);
    assert.equal(res.body.paymentReceived, true);
    const [saved] = await ordersOf(merchant);
    assert.equal(saved.orderStatus, 'Needs_Attention');

    const retry = await api('/api/orders/retry', { cookie: merchantCookie(merchant.shopDomain), body: { id: saved.id } });
    assert.equal(retry.status, 200);
    assert.equal((await db.order.findUnique({ where: { id: saved.id } })).orderStatus, 'Synced');
  });

  test('a paid order whose customer never came back is found and placed', async () => {
    // No quote first: a quote starts the check, which then waits five minutes before running again.
    const { merchant, startPayment } = await store();
    const started = await startPayment({ paymentMethod: 'PREPAID' });
    razorpay.addPayment({ order_id: started.body.orderId, amount: started.body.amount });
    await db.order.updateMany({ where: { merchantId: merchant.id }, data: { createdAt: new Date(Date.now() - 15 * 60 * 1000) } });

    // Getting a total for any customer starts the store's background check.
    await api('/api/checkout/quote', { body: { shop: merchant.shopDomain, sessionToken: checkoutSession(merchant.shopDomain, uniquePhone()), items: [{ variantId: variant(100), quantity: 1 }] } });
    await eventually(async () => {
      const [saved] = await ordersOf(merchant);
      assert.equal(saved.orderStatus, 'Synced');
      assert.ok(saved.paymentId);
    });
  });

  test('stores without online payments can\'t start one', async () => {
    const otpCod = await store({ plan: 'OTP_COD' });
    assert.equal((await otpCod.startPayment({ paymentMethod: 'PREPAID' })).status, 403);
    const noKeys = await createMerchant();
    const res = await api('/api/checkout/create-razorpay-order', {
      body: { shop: noKeys.shopDomain, sessionToken: checkoutSession(noKeys.shopDomain, uniquePhone()), items: [{ variantId: variant(100), quantity: 1 }], paymentMethod: 'PREPAID' },
    });
    assert.equal(res.status, 400);
  });
});

describe('Partial COD', () => {
  const partial = { isPartialCodEnabled: true, partialCodAmount: 200 };

  test('the part is paid online, and Shopify shows it paid with the rest due', async () => {
    const { merchant, shop, quote, startPayment, order, pay } = await store({ plan: 'OTP_COD', payment: partial });
    const { partial: offer } = await quote();
    assert.equal(offer.amountDueNow, 200);

    const started = await startPayment({ paymentMethod: 'PARTIAL COD', quoteToken: offer.quoteToken, expectedTotal: offer.total });
    assert.equal(started.status, 200);
    assert.equal(started.body.amount, 20000);

    const res = await order({ paymentMethod: 'PARTIAL COD', quoteToken: offer.quoteToken, expectedTotal: offer.total, ...pay(started.body.orderId, 20000) });
    assert.equal(res.status, 200, JSON.stringify(res.body));

    const [saved] = await ordersOf(merchant);
    assert.equal(saved.amountPaid, 200);
    assert.equal(saved.total, 1000);
    assert.equal(saved.paymentMethod, 'PARTIAL COD');
    assert.equal(saved.feePercent, 1);

    const [complete] = completes(shop);
    assert.equal(complete.paymentPending, true, 'the order stays partly unpaid in Shopify');
    const placed = shopify.orders.get(res.body.shopifyOrderId);
    assert.deepEqual(placed.transactions, [{ kind: 'sale', source: 'external', status: 'success', amount: '200', currency: 'INR', gateway: 'Razorpay', authorization: saved.paymentId }]);
    const draft = shopify.callsOf('draftOrderCreate', shop)[0].variables.input;
    assert.equal(draft.note, 'Order via CheckoutFlow. Partial COD: ₹200 paid online, ₹800 to collect on delivery.');
    assert.deepEqual(draft.tags, ['PARTIAL COD', 'CheckoutFlow']);
  });

  test('Partial COD is refused where the store hasn\'t switched it on', async () => {
    const full = await store({ plan: 'FULL', payment: partial });
    assert.equal((await full.startPayment({ paymentMethod: 'PARTIAL COD' })).status, 403);
    assert.equal((await full.order({ paymentMethod: 'PARTIAL COD' })).status, 403);
    const off = await store({ plan: 'OTP_COD' });
    assert.equal((await off.startPayment({ paymentMethod: 'PARTIAL COD' })).status, 403);
  });

  test('on OTP + COD, COD still works and online payments go to Shopify instead', async () => {
    const { order } = await store({ plan: 'OTP_COD', payment: partial });
    assert.equal((await order({ paymentMethod: 'COD' })).status, 200);
    assert.equal((await order({ paymentMethod: 'PREPAID' })).status, 403);
  });
});

describe('offer use is counted once', () => {
  test('a code\'s use is recorded once, even when the order is processed again', async () => {
    const { merchant, phone, quote, order } = await store({ discounts: [{ code: 'ONCE10', type: 'percentage', value: 10, usageLimit: 5, perCustomerLimit: 1 }] });
    const { cod } = await quote({ couponCode: 'ONCE10' });
    const res = await order({ paymentMethod: 'COD', appliedCoupon: { code: 'ONCE10' }, quoteToken: cod.quoteToken, expectedTotal: cod.total });
    assert.equal(res.status, 200);

    const discount = await db.discount.findFirst({ where: { merchantId: merchant.id, code: 'ONCE10' } });
    await eventually(async () => assert.equal((await db.discount.findUnique({ where: { id: discount.id } })).usageCount, 1));

    // As if the server stopped after Shopify took the order but before saving that.
    const [saved] = await ordersOf(merchant);
    await db.order.update({ where: { id: saved.id }, data: { orderStatus: 'Needs_Attention', paymentId: 'pay_manual' } });
    const retry = await api('/api/orders/retry', { cookie: merchantCookie(merchant.shopDomain), body: { id: saved.id } });
    assert.equal(retry.status, 200);
    assert.equal(retry.body.shopifyOrderId, saved.shopifyOrderId, 'Shopify\'s existing order is found, not a new one');

    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.equal((await db.discount.findUnique({ where: { id: discount.id } })).usageCount, 1);
    assert.deepEqual(await db.discountRedemption.findMany({ where: { discountId: discount.id }, select: { orderId: true, phone: true } }), [{ orderId: saved.id, phone }]);

    const reuse = await quote({ couponCode: 'ONCE10' });
    assert.equal(reuse.code, 'INVALID_COUPON', 'the same customer can\'t use it again');
  });

  test('a quote whose offer ran out meanwhile is priced again', async () => {
    const { merchant, quote, order } = await store({ discounts: [{ code: 'LAST', type: 'flat', value: 100, usageLimit: 1 }] });
    const { cod } = await quote({ couponCode: 'LAST' });
    assert.equal(cod.total, 969);
    await db.discount.updateMany({ where: { merchantId: merchant.id, code: 'LAST' }, data: { usageCount: 1 } });
    const res = await order({ paymentMethod: 'COD', appliedCoupon: { code: 'LAST' }, quoteToken: cod.quoteToken, expectedTotal: cod.total });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'INVALID_COUPON');
    assert.equal((await ordersOf(merchant)).length, 0);
  });

  test('a free gift is placed as a free line and counted as used', async () => {
    const gift = variant(300);
    const { merchant, shop, quote, order } = await store({ discounts: [{ isAuto: true, type: 'free_gift', giftVariantId: gift, giftTitle: 'Mug', usageLimit: 10 }] });
    const { cod } = await quote();
    const res = await order({ paymentMethod: 'COD', quoteToken: cod.quoteToken, expectedTotal: cod.total });
    assert.equal(res.status, 200);
    const draft = shopify.callsOf('draftOrderCreate', shop)[0].variables.input;
    assert.ok(draft.lineItems.some((lineItem) => lineItem.variantId.endsWith(`/${gift}`) && lineItem.appliedDiscount.value === 100));
    const [saved] = await ordersOf(merchant);
    assert.match(saved.productTitle, /Free: Mug/);
    await eventually(async () => assert.equal((await db.discount.findFirst({ where: { merchantId: merchant.id } })).usageCount, 1));
  });
});

describe('OTP Verify plan', () => {
  test('the customer is sent to a Shopify cart with their details, and the popup can\'t place orders', async () => {
    const { merchant, shop, sessionToken, phone, items, order } = await store({ plan: 'OTP_ONLY' });
    await db.customerProfile.create({ data: { merchantId: merchant.id, phone, name: 'Asha Kumar', email: 'asha@example.com', address: '12 MG Road', city: 'Pune', state: 'Maharashtra', pincode: '411001', lastOrderAt: new Date() } });

    const res = await api('/api/checkout/shopify-redirect', { body: { shop, sessionToken, items } });
    assert.equal(res.status, 200);
    assert.equal(res.body.checkoutUrl, `https://${shop}/cart/c/test-cart`);

    const [cart] = shopify.carts;
    assert.equal(cart.token, 'storefront-test-token');
    assert.deepEqual(cart.input.attributes, [{ key: '_checkoutflow_plan', value: 'OTP_ONLY' }]);
    assert.equal(cart.input.buyerIdentity.phone, `+91${phone}`);
    assert.equal(cart.input.buyerIdentity.email, 'asha@example.com');
    assert.equal(cart.input.delivery.addresses[0].address.deliveryAddress.provinceCode, 'MH');
    assert.ok(!res.body.checkoutUrl.includes('MG'), 'no address in the link');

    const saved = await db.merchant.findUnique({ where: { id: merchant.id } });
    assert.ok(saved.storefrontToken.startsWith('enc:v1:'), 'the Storefront token is stored encrypted');

    assert.equal((await order({ paymentMethod: 'COD' })).status, 403);
    assert.equal((await api('/api/checkout/shopify-redirect', { body: { shop, sessionToken: 'bad', items } })).status, 401);
  });

  test('Full Checkout stores keep customers in the popup', async () => {
    const { shop, sessionToken, items } = await store({ plan: 'FULL' });
    assert.equal((await api('/api/checkout/shopify-redirect', { body: { shop, sessionToken, items } })).status, 403);
  });
});
