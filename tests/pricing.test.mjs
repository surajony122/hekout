// What a cart costs: the store's own codes and offers, Shopify codes, payment-method
// discounts and fees, Partial COD, shipping rules and signed quotes.
import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, checkoutSession, createMerchant, db, readTokenPayload, signedToken, uniquePhone } from './helpers/app.mjs';
import { shopify } from './helpers/fake-services.mjs';
import { resetFakeServices as resetFakes } from './helpers/fake-services.mjs';

beforeEach(() => resetFakes());

let variantCounter = 100000;
const variant = (price, extra = {}) => {
  const id = String(variantCounter++);
  shopify.variants.set(id, { price, ...extra });
  return id;
};

async function setup({ plan = 'FULL', payment = {}, discounts = [], shippingRules = [] } = {}) {
  const merchant = await createMerchant({ plan, payment });
  for (const discount of discounts) {
    await db.discount.create({ data: { merchantId: merchant.id, code: '', title: 'Offer', value: 0, ...discount } });
  }
  for (const rule of shippingRules) {
    await db.shippingRule.create({ data: { merchantId: merchant.id, name: 'Rule', ...rule } });
  }
  const phone = uniquePhone();
  const shop = merchant.shopDomain;
  const sessionToken = checkoutSession(shop, phone);
  const quote = (items, extra = {}) => api('/api/checkout/quote', { body: { shop, sessionToken, items, ...extra } });
  return { merchant, phone, shop, sessionToken, quote };
}

const line = (variantId, quantity = 1) => ({ variantId, quantity, title: 'Item' });
const lastCalculation = (shop) => shopify.callsOf('draftOrderCalculate', shop).at(-1).variables.input;

describe('payment-method pricing', () => {
  test('COD adds the ₹69 fee by default, prepaid pays the cart total', async () => {
    const { quote } = await setup();
    const res = await quote([line(variant(500), 2)]);
    assert.equal(res.status, 200);
    assert.deepEqual(
      { subtotal: res.body.cod.subtotal, codFee: res.body.cod.codFee, total: res.body.cod.total, due: res.body.cod.amountDueNow },
      { subtotal: 1000, codFee: 69, total: 1069, due: 0 },
    );
    assert.equal(res.body.prepaid.total, 1000);
    assert.equal(res.body.prepaid.amountDueNow, 1000);
    assert.equal(res.body.partial, null);
  });

  test('a prepaid discount only lowers the prepaid total', async () => {
    const { quote } = await setup({ payment: { isPrepaidDiscountEnabled: true, prepaidDiscountType: 'percentage', prepaidDiscountValue: 10, isCodFeeEnabled: false } });
    const res = await quote([line(variant(400), 1), line(variant(600), 1)]);
    assert.equal(res.body.prepaid.prepaidDiscount, 100);
    assert.equal(res.body.prepaid.discount, 0);
    assert.equal(res.body.prepaid.total, 900);
    assert.equal(res.body.cod.total, 1000);
  });

  test('a shipping fee applies under the free-shipping threshold, and replaces the COD fee', async () => {
    const { quote } = await setup({ payment: { isShippingFeeEnabled: true, shippingFeeAmount: 50, freeShippingThreshold: 999 } });
    const small = await quote([line(variant(500))]);
    assert.equal(small.body.cod.shippingFee, 50);
    assert.equal(small.body.cod.codFee, 0);
    assert.equal(small.body.cod.total, 550);
    assert.equal(small.body.prepaid.total, 550);

    const big = await quote([line(variant(1000))]);
    assert.equal(big.body.cod.shippingFee, 0);
    assert.equal(big.body.cod.codFee, 69);
  });

  test('carts with bad items are refused before reaching Shopify', async () => {
    const { quote, shop } = await setup();
    for (const items of [[], [{ variantId: 'abc', quantity: 1 }], [{ variantId: '1', quantity: 0 }], [{ variantId: '1', quantity: 1001 }], [{ variantId: '1', quantity: 1.5 }], 'nope']) {
      const res = await quote(items);
      assert.equal(res.status, 400, JSON.stringify(items));
    }
    assert.equal(shopify.callsOf('draftOrderCalculate', shop).length, 0);
  });

  test('prices always come from Shopify, never from the browser', async () => {
    const { quote } = await setup();
    const res = await quote([{ variantId: variant(800), quantity: 1, price: 1 }]);
    assert.equal(res.body.prepaid.total, 800);
  });
});

describe('the store\'s own codes', () => {
  test('a percentage code is applied by us and never sent to Shopify', async () => {
    const { quote, shop } = await setup({ discounts: [{ code: 'SAVE10', type: 'percentage', value: 10 }] });
    const res = await quote([line(variant(500), 2)], { couponCode: ' save10 ' });
    assert.equal(res.status, 200);
    assert.equal(res.body.cod.discount, 100);
    assert.equal(res.body.cod.total, 969);
    assert.equal(res.body.prepaid.total, 900);
    for (const call of shopify.callsOf('draftOrderCalculate', shop)) assert.deepEqual(call.variables.input.discountCodes, []);
    assert.equal(lastCalculation(shop).appliedDiscount.valueType, 'FIXED_AMOUNT');
  });

  test('flat codes and the maximum discount', async () => {
    const { quote } = await setup({
      discounts: [
        { code: 'FLAT150', type: 'flat', value: 150 },
        { code: 'HALF', type: 'percentage', value: 50, maxDiscount: 200 },
      ],
    });
    const item = variant(1000);
    assert.equal((await quote([line(item)], { couponCode: 'FLAT150' })).body.prepaid.total, 850);
    assert.equal((await quote([line(item)], { couponCode: 'HALF' })).body.prepaid.total, 800);
  });

  test('minimum cart value and item count give a clear reason', async () => {
    const { quote } = await setup({
      discounts: [
        { code: 'BIG', type: 'flat', value: 100, minCartValue: 2000 },
        { code: 'THREE', type: 'flat', value: 100, minItems: 3 },
      ],
    });
    const item = variant(500);
    const big = await quote([line(item, 2)], { couponCode: 'BIG' });
    assert.equal(big.status, 400);
    assert.equal(big.body.code, 'INVALID_COUPON');
    assert.equal(big.body.error, 'Add items worth ₹1,000 more to use this code.');
    const three = await quote([line(item, 2)], { couponCode: 'THREE' });
    assert.equal(three.body.error, 'Add 1 more item to use this code.');
    assert.equal((await quote([line(item, 3)], { couponCode: 'THREE' })).status, 200);
  });

  test('slabs give the best tier the cart has reached', async () => {
    const { quote } = await setup({
      discounts: [{
        isAuto: true, type: 'slab',
        slabs: [{ min: 500, type: 'flat', value: 50 }, { min: 1000, type: 'percentage', value: 10 }, { min: 3000, type: 'percentage', value: 20 }],
      }],
    });
    assert.equal((await quote([line(variant(400))])).body.prepaid.discount, 0);
    assert.equal((await quote([line(variant(600))])).body.prepaid.discount, 50);
    assert.equal((await quote([line(variant(1500))])).body.prepaid.discount, 150);
    assert.equal((await quote([line(variant(3000))])).body.prepaid.discount, 600);
  });

  test('tag conditions only discount matching products, ignoring case', async () => {
    const { quote } = await setup({ discounts: [{ isAuto: true, type: 'percentage', value: 20, tags: ['Summer'] }] });
    const tagged = variant(500, { tags: ['summer', 'tee'] });
    const plain = variant(300, { tags: ['winter'] });
    const res = await quote([line(tagged), line(plain)]);
    assert.equal(res.body.prepaid.discount, 100);
    assert.equal((await quote([line(plain)])).body.prepaid.discount, 0);
  });

  test('collection conditions only discount products in those collections', async () => {
    const sale = 'gid://shopify/Collection/77';
    const { quote } = await setup({ discounts: [{ code: 'SALE', type: 'percentage', value: 50, collections: [{ id: sale, title: 'Sale' }] }] });
    const inSale = variant(400, { collections: [sale] });
    const notInSale = variant(600, { collections: ['gid://shopify/Collection/1'] });
    assert.equal((await quote([line(inSale), line(notInSale)], { couponCode: 'SALE' })).body.prepaid.discount, 200);
    const none = await quote([line(notInSale)], { couponCode: 'SALE' });
    assert.equal(none.status, 400);
    assert.equal(none.body.error, "This code isn't valid for the items in your cart.");
  });

  test('if Shopify can\'t say which products are tagged, those offers just don\'t apply', async () => {
    const { quote } = await setup({ discounts: [{ isAuto: true, type: 'percentage', value: 20, tags: ['summer'] }] });
    shopify.failVariantDetails = true;
    const res = await quote([line(variant(500, { tags: ['summer'] }))]);
    assert.equal(res.status, 200);
    assert.equal(res.body.prepaid.discount, 0);
  });

  test('codes limited to a way of paying', async () => {
    const { quote } = await setup({
      discounts: [
        { code: 'ONLINE', type: 'flat', value: 100, paymentMethods: ['PREPAID'] },
        { code: 'PARTONLY', type: 'flat', value: 100, paymentMethods: ['PARTIAL COD'] },
      ],
    });
    const item = variant(1000);
    const online = await quote([line(item)], { couponCode: 'ONLINE' });
    assert.equal(online.body.prepaid.discount, 100);
    assert.equal(online.body.cod.discount, 0);
    const partial = await quote([line(item)], { couponCode: 'PARTONLY' });
    assert.equal(partial.status, 400);
    assert.equal(partial.body.error, "This code isn't valid for this way of paying.");
  });

  test('dates, total uses and per-customer uses decide whether a code can be used', async () => {
    const { merchant, phone, quote, shop } = await setup({
      discounts: [
        { code: 'ENDED', type: 'flat', value: 50, endsAt: new Date(Date.now() - 1000) },
        { code: 'LATER', type: 'flat', value: 50, startsAt: new Date(Date.now() + 86400000) },
        { code: 'USEDUP', type: 'flat', value: 50, usageLimit: 2, usageCount: 2 },
        { code: 'ONCE', type: 'flat', value: 50, perCustomerLimit: 1 },
        { code: 'OFF', type: 'flat', value: 50, isActive: false },
      ],
    });
    const item = variant(500);
    for (const code of ['ENDED', 'LATER', 'USEDUP']) {
      const res = await quote([line(item)], { couponCode: code });
      assert.equal(res.status, 400, code);
      assert.equal(res.body.error, 'This coupon is no longer available.');
    }
    // An inactive code is unknown to us, so it goes to Shopify, which doesn't know it either.
    assert.equal((await quote([line(item)], { couponCode: 'OFF' })).body.error, 'This coupon is not valid for your cart.');

    assert.equal((await quote([line(item)], { couponCode: 'ONCE' })).status, 200);
    const once = await db.discount.findFirst({ where: { merchantId: merchant.id, code: 'ONCE' } });
    await db.discountRedemption.create({ data: { discountId: once.id, orderId: 'earlier-order', phone } });
    assert.equal((await quote([line(item)], { couponCode: 'ONCE' })).status, 400);
    const someoneElse = await api('/api/checkout/quote', { body: { shop, sessionToken: checkoutSession(shop, uniquePhone()), items: [line(item)], couponCode: 'ONCE' } });
    assert.equal(someoneElse.status, 200);
  });
});

describe('automatic offers and Shopify codes together', () => {
  test('combinable offers add up; an offer that stands alone is used only if it saves more', async () => {
    const { quote } = await setup({
      discounts: [
        { isAuto: true, type: 'flat', value: 30, canCombine: true },
        { isAuto: true, type: 'flat', value: 40, canCombine: true },
        { isAuto: true, type: 'flat', value: 60 },
      ],
    });
    assert.equal((await quote([line(variant(1000))])).body.prepaid.discount, 70);
  });

  test('a Shopify code that won\'t combine wins over the store\'s offers', async () => {
    shopify.codes.set('SHOP5', { type: 'percentage', value: 5, combinesWithOrderDiscounts: false });
    const { quote } = await setup({ payment: { isPrepaidDiscountEnabled: true, prepaidDiscountType: 'percentage', prepaidDiscountValue: 10 } });
    const res = await quote([line(variant(1000))], { couponCode: 'shop5' });
    assert.equal(res.status, 200);
    assert.equal(res.body.prepaid.prepaidDiscount, 0);
    assert.equal(res.body.prepaid.discount, 50);
    assert.equal(res.body.prepaid.total, 950);
  });

  test('a Shopify code that combines stacks with the prepaid discount', async () => {
    shopify.codes.set('STACK5', { type: 'percentage', value: 5, combinesWithOrderDiscounts: true });
    const { quote } = await setup({ payment: { isPrepaidDiscountEnabled: true, prepaidDiscountType: 'percentage', prepaidDiscountValue: 10 } });
    const res = await quote([line(variant(1000))], { couponCode: 'STACK5' });
    assert.equal(res.body.prepaid.discount, 50);
    assert.equal(res.body.prepaid.prepaidDiscount, 95);
    assert.equal(res.body.prepaid.total, 855);
  });

  test('unknown Shopify codes and Shopify\'s own reasons are shown to the customer', async () => {
    shopify.codes.set('MIN999', { type: 'fixed', value: 100, warning: 'Spend ₹999 to use this code' });
    const { quote } = await setup();
    const unknown = await quote([line(variant(500))], { couponCode: 'NOPE' });
    assert.equal(unknown.status, 400);
    assert.equal(unknown.body.code, 'INVALID_COUPON');
    const explained = await quote([line(variant(500))], { couponCode: 'MIN999' });
    assert.equal(explained.body.error, 'Spend ₹999 to use this code');
  });

  test('a typed store code that can\'t combine switches off Shopify\'s automatic discount', async () => {
    shopify.automatic = { percent: 5 };
    try {
      const { quote, shop } = await setup({ discounts: [{ code: 'MINE20', type: 'percentage', value: 20 }] });
      const res = await quote([line(variant(1000))], { couponCode: 'MINE20' });
      assert.equal(res.body.prepaid.discount, 200);
      assert.equal(res.body.prepaid.total, 800);
      assert.equal(lastCalculation(shop).acceptAutomaticDiscounts, false);

      // Without the code, Shopify's automatic discount stays and stand-alone offers don't join it.
      const { quote: plainQuote } = await setup({ discounts: [{ isAuto: true, type: 'flat', value: 30 }, { isAuto: true, type: 'flat', value: 10, canCombine: true }] });
      const plain = await plainQuote([line(variant(1000))]);
      assert.equal(plain.body.prepaid.discount, 60);
    } finally {
      shopify.automatic = null;
    }
  });
});

describe('free gifts', () => {
  test('a gift is added free, shown once with its value, and left out of subtotal and discount', async () => {
    const gift = variant(250);
    const { quote, shop } = await setup({ discounts: [{ isAuto: true, type: 'free_gift', giftVariantId: gift, giftTitle: 'Tote bag', giftQuantity: 2, minCartValue: 800 }] });
    const item = variant(500);

    const res = await quote([line(item, 2)]);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.cod.gifts, [{ title: 'Tote bag', quantity: 2, value: 500 }]);
    assert.equal(res.body.cod.subtotal, 1000);
    assert.equal(res.body.cod.discount, 0);
    assert.equal(res.body.cod.total, 1069);
    assert.equal(res.body.prepaid.total, 1000);

    const giftLine = lastCalculation(shop).lineItems.find((lineItem) => lineItem.variantId.endsWith(`/${gift}`));
    assert.deepEqual(giftLine.appliedDiscount, { title: 'Free Gift', value: 100, valueType: 'PERCENTAGE' });
    assert.equal(giftLine.quantity, 2);

    assert.deepEqual((await quote([line(item, 1)])).body.cod.gifts, [], 'below the minimum, no gift');
  });

  test('a gift alongside a real discount keeps both amounts right', async () => {
    const gift = variant(300);
    const { quote } = await setup({
      discounts: [
        { isAuto: true, type: 'free_gift', giftVariantId: gift, giftTitle: 'Mug' },
        { code: 'TEN', type: 'percentage', value: 10 },
      ],
    });
    const res = await quote([line(variant(1000))], { couponCode: 'TEN' });
    assert.equal(res.body.prepaid.subtotal, 1000);
    assert.equal(res.body.prepaid.discount, 100);
    assert.equal(res.body.prepaid.total, 900);
    assert.equal(res.body.prepaid.gifts[0].value, 300);
  });

  test('an out-of-stock gift doesn\'t stop the sale', async () => {
    const gift = variant(250, { available: false });
    const { quote } = await setup({ discounts: [{ isAuto: true, type: 'free_gift', giftVariantId: gift, giftTitle: 'Gone' }] });
    const res = await quote([line(variant(500))]);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.cod.gifts, []);
    assert.equal(res.body.cod.total, 569);
    assert.deepEqual(readTokenPayload(res.body.cod.quoteToken).pricing.ruleIds, [], 'a gift that was dropped isn\'t counted as used');
  });
});

describe('Partial COD', () => {
  const partialPayment = { isPartialCodEnabled: true, partialCodAmount: 200, razorpayKeyId: 'rzp_test_x', razorpayKeySecret: 'secret' };

  test('a flat part is paid now and the rest on delivery, with no COD fee', async () => {
    const { quote } = await setup({ plan: 'OTP_COD', payment: partialPayment });
    const res = await quote([line(variant(1000))]);
    assert.equal(res.body.partial.codFee, 0);
    assert.equal(res.body.partial.total, 1000);
    assert.equal(res.body.partial.amountDueNow, 200);
    assert.equal(res.body.partial.amountDueLater, 800);
  });

  test('a percentage part, its own discount and free shipping', async () => {
    const { quote } = await setup({
      plan: 'OTP_COD',
      payment: {
        ...partialPayment, partialCodType: 'percentage', partialCodAmount: 25,
        isPartialDiscountEnabled: true, partialDiscountType: 'flat', partialDiscountValue: 100,
        partialFreeShipping: true, isShippingFeeEnabled: true, shippingFeeAmount: 60, freeShippingThreshold: 5000,
      },
    });
    const res = await quote([line(variant(1000))]);
    assert.equal(res.body.partial.prepaidDiscount, 100);
    assert.equal(res.body.partial.shippingFee, 0);
    assert.equal(res.body.partial.total, 900);
    assert.equal(res.body.partial.amountDueNow, 225);
    assert.equal(res.body.cod.shippingFee, 60);
  });

  test('only the OTP + COD plan offers Partial COD', async () => {
    const { quote } = await setup({ plan: 'FULL', payment: partialPayment });
    assert.equal((await quote([line(variant(1000))])).body.partial, null);
  });

  test('the part due can never be more than the order', async () => {
    const { quote } = await setup({ plan: 'OTP_COD', payment: { ...partialPayment, partialCodAmount: 5000 } });
    const res = await quote([line(variant(300))]);
    assert.equal(res.body.partial.amountDueNow, 300);
  });

  test('the widget only shows Partial COD when it can really be used', async () => {
    const ready = await createMerchant({ plan: 'OTP_COD', payment: partialPayment });
    const noKeys = await createMerchant({ plan: 'OTP_COD', payment: { isPartialCodEnabled: true, partialCodAmount: 200 } });
    const fullPlan = await createMerchant({ plan: 'FULL', payment: partialPayment });
    const config = async (merchant) => (await api(`/api/widget/config?shop=${merchant.shopDomain}`, { method: 'GET' })).body.config;
    assert.equal((await config(ready)).hasPartialCod, true);
    assert.equal((await config(ready)).hasRazorpay, false, 'OTP + COD sends online payments to Shopify');
    assert.equal((await config(noKeys)).hasPartialCod, false);
    assert.equal((await config(fullPlan)).hasPartialCod, false);
  });
});

describe('shipping rules', () => {
  test('pincode beats state beats cart value, and the cheapest equal rule wins', async () => {
    const { quote } = await setup({
      shippingRules: [
        { fee: 80 },
        { fee: 70 },
        { fee: 40, states: ['Maharashtra'] },
        { fee: 20, pincodes: ['110*'] },
        { fee: 10, pincodes: ['560001'], paymentMethods: ['PREPAID'] },
      ],
    });
    const item = variant(500);
    const at = (state, pincode) => quote([line(item)], { address: '1 Road', state, pincode });
    assert.equal((await at('Goa', '403001')).body.prepaid.shippingFee, 70);
    assert.equal((await at('maharashtra', '400001')).body.prepaid.shippingFee, 40);
    assert.equal((await at('Delhi', '110017')).body.prepaid.shippingFee, 20);
    const bengaluru = await at('Karnataka', '560001');
    assert.equal(bengaluru.body.prepaid.shippingFee, 10);
    assert.equal(bengaluru.body.cod.shippingFee, 70);
    assert.equal(bengaluru.body.cod.codFee, 0, 'the COD fee is waived when shipping is charged');
  });

  test('cart value bands and free-shipping offers', async () => {
    const { quote } = await setup({
      shippingRules: [{ fee: 99, maxCart: 500 }, { fee: 0, minCart: 500 }],
      discounts: [{ code: 'FREESHIP', type: 'free_shipping' }],
    });
    const small = await quote([line(variant(300))]);
    assert.equal(small.body.prepaid.shippingFee, 99);
    assert.equal(small.body.prepaid.total, 399);
    assert.equal((await quote([line(variant(500))])).body.prepaid.shippingFee, 0);
    const free = await quote([line(variant(300))], { couponCode: 'FREESHIP' });
    assert.equal(free.body.prepaid.shippingFee, 0);
    assert.equal(free.body.prepaid.total, 300);
  });

  test('prepaid free shipping beats a rule', async () => {
    const { quote } = await setup({ payment: { prepaidFreeShipping: true }, shippingRules: [{ fee: 50 }] });
    const res = await quote([line(variant(300))]);
    assert.equal(res.body.prepaid.shippingFee, 0);
    assert.equal(res.body.cod.shippingFee, 50);
  });
});

describe('quote tokens', () => {
  test('a quote token is signed, tied to the store and phone, and expires in 10 minutes', async () => {
    const { quote, shop, phone } = await setup();
    const res = await quote([line(variant(500))]);
    const token = readTokenPayload(res.body.cod.quoteToken);
    assert.equal(token.shop, shop);
    assert.equal(token.phone, phone);
    assert.ok(token.exp <= Date.now() + 10 * 60 * 1000 && token.exp > Date.now() + 9 * 60 * 1000);
    assert.equal(token.pricing.total, 569);
  });

  test('only the OTP + COD plan\'s chosen method is priced when asked', async () => {
    const { quote, shop } = await setup({ plan: 'OTP_COD' });
    const res = await quote([line(variant(500))], { methods: ['COD'] });
    assert.equal(res.body.prepaid, null);
    assert.equal(res.body.cod.total, 569);
    assert.equal(shopify.callsOf('draftOrderCalculate', shop).length, 1, 'one calculation is enough when the COD fee is known');
  });

  test('stores on the OTP Verify plan get no popup totals', async () => {
    const { quote } = await setup({ plan: 'OTP_ONLY' });
    assert.equal((await quote([line(variant(500))])).status, 403);
  });

  test('forged quote tokens are ignored, so a lower price can\'t be slipped in', async () => {
    const { shop, phone, sessionToken, merchant } = await setup();
    const item = variant(500);
    const forged = signedToken('checkout-session-v1', {
      shop, phone, exp: Date.now() + 60000,
      pricing: { isCod: true, isPartial: false, total: 1, amountDueNow: 0, ruleIds: [], draftInput: { lineItems: [] } },
    });
    const res = await api('/api/create-order', { body: { shop, sessionToken, items: [line(item)], paymentMethod: 'COD', quoteToken: forged, expectedTotal: 1 } });
    assert.equal(res.status, 409);
    assert.equal(res.body.code, 'TOTAL_CHANGED');
    assert.equal(await db.order.count({ where: { merchantId: merchant.id } }), 0);
  });
});
