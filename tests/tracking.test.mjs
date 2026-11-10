// Google Analytics, Google Ads, the Meta Pixel and Meta's Conversions API.
import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { api, checkoutSession, createMerchant, db, eventually, merchantCookie, razorpaySignature, uniquePhone } from './helpers/app.mjs';
import { meta, razorpay, resetFakeServices, shopify } from './helpers/fake-services.mjs';
import { openStorefront, waitFor } from './helpers/widget.mjs';

beforeEach(() => resetFakeServices());

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const META_TOKEN = 'EAAtestTokenNotReal1234567890abcdef';

let variantCounter = 400000;
const variant = (price) => {
  const id = String(variantCounter++);
  shopify.variants.set(id, { price });
  return id;
};

describe('tracking settings', () => {
  test('IDs are checked, tidied and saved; the Meta token is encrypted and never sent back', async () => {
    const merchant = await createMerchant();
    const cookie = merchantCookie(merchant.shopDomain);

    const saved = await api('/api/settings/widget', {
      cookie,
      body: { fbPixelId: '123456789012', metaCapiToken: META_TOKEN, ga4MeasurementId: ' g-abc123xyz ', googleAdsId: 'aw-987654321', googleAdsLabel: 'AbC-D_efG' },
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(saved.body.settings.hasMetaCapiToken, true);
    assert.ok(!saved.text.includes(META_TOKEN));
    assert.equal(saved.body.settings.metaCapiToken, undefined);

    const row = await db.widgetSettings.findUnique({ where: { merchantId: merchant.id } });
    assert.ok(row.metaCapiToken.startsWith('enc:v1:'));
    assert.deepEqual([row.ga4MeasurementId, row.googleAdsId, row.googleAdsLabel], ['G-ABC123XYZ', 'AW-987654321', 'AbC-D_efG']);

    const config = await api(`/api/widget/config?shop=${merchant.shopDomain}`, { method: 'GET' });
    assert.equal(config.body.config.ga4MeasurementId, 'G-ABC123XYZ');
    assert.equal(config.body.config.googleAdsId, 'AW-987654321');
    assert.equal(config.body.config.googleAdsLabel, 'AbC-D_efG');
    assert.equal(config.body.config.fbPixelId, '123456789012');
    assert.ok(!config.text.includes('enc:v1:') && !config.text.includes(META_TOKEN));

    // Saving other settings keeps the token, and it can be removed on purpose.
    await api('/api/settings/widget', { cookie, body: { primaryColor: '#123456' } });
    assert.ok((await db.widgetSettings.findUnique({ where: { merchantId: merchant.id } })).metaCapiToken);
    const removed = await api('/api/settings/widget', { cookie, body: { removeMetaCapiToken: true, ga4MeasurementId: '' } });
    assert.equal(removed.body.settings.hasMetaCapiToken, false);
    const after = await db.widgetSettings.findUnique({ where: { merchantId: merchant.id } });
    assert.equal(after.metaCapiToken, null);
    assert.equal(after.ga4MeasurementId, null);
    assert.equal(after.googleAdsId, 'AW-987654321');
  });

  test('anything that isn\'t a real ID is refused, since IDs go into script URLs', async () => {
    const merchant = await createMerchant();
    const cookie = merchantCookie(merchant.shopDomain);
    const bad = [
      { ga4MeasurementId: 'UA-12345-1' },
      { ga4MeasurementId: 'G-ABC"><script>alert(1)</script>' },
      { googleAdsId: '987654321' },
      { googleAdsId: 'AW-12&x=1' },
      { googleAdsLabel: 'bad label/../' },
      { googleAdsId: '', googleAdsLabel: 'AbC-D_efG' },
      { metaCapiToken: 'short' },
      { metaCapiToken: 'EAA has spaces in it and more text here' },
    ];
    for (const body of bad) {
      const res = await api('/api/settings/widget', { cookie, body });
      assert.equal(res.status, 400, JSON.stringify(body));
    }
    assert.equal(await db.widgetSettings.count({ where: { merchantId: merchant.id } }), 0);
  });
});

async function trackedStore({ token = META_TOKEN, plan = 'FULL', payment = {} } = {}) {
  const merchant = await createMerchant({
    plan,
    payment: { razorpayKeyId: 'rzp_test_key', razorpayKeySecret: 'rzp-secret', ...payment },
    widget: { fbPixelId: '123456789012', ...(token ? { metaCapiToken: token } : {}) },
  });
  const phone = uniquePhone();
  const shop = merchant.shopDomain;
  const sessionToken = checkoutSession(shop, phone);
  return { merchant, phone, shop, sessionToken };
}

const browser = {
  'cf-connecting-ip': '203.0.113.9',
  'user-agent': 'Mozilla/5.0 (Linux; Android 14) TestBrowser/1.0',
};
const browserTracking = { fbp: 'fb.1.1700000000000.1234567890', fbc: 'fb.1.1700000000000.IwAR-test_click', sourceUrl: 'https://my-brand.example/products/tee' };

describe('Meta Conversions API', () => {
  test('a placed order is sent once, matched to the customer and to the browser\'s Purchase event', async () => {
    const { merchant, phone, shop, sessionToken } = await trackedStore();
    const tee = variant(500);
    const gift = variant(200);
    await db.discount.create({ data: { merchantId: merchant.id, code: '', title: 'Gift', type: 'free_gift', value: 0, isAuto: true, giftVariantId: gift, giftTitle: 'Mug' } });

    const res = await api('/api/create-order', {
      headers: browser,
      body: {
        shop, sessionToken, items: [{ variantId: tee, quantity: 2 }], paymentMethod: 'COD',
        customerName: 'Asha Kumar', customerEmail: ' Asha@Example.com ', address: '12 MG Road', city: 'New Delhi', state: 'Delhi', pincode: '110001',
        tracking: { ...browserTracking, fbp: 'not-a-cookie<script>' },
      },
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));

    const [sent] = await eventually(() => { assert.equal(meta.requests.length, 1); return meta.requests; });
    assert.equal(sent.path, '/v25.0/123456789012/events');
    assert.equal(sent.body.access_token, META_TOKEN);
    const [event] = sent.body.data;
    assert.equal(event.event_name, 'Purchase');
    assert.equal(event.event_id, `order_${res.body.orderId}`);
    assert.equal(event.action_source, 'website');
    assert.equal(event.user_data.ph[0], sha256(`91${phone}`));
    assert.equal(event.user_data.em[0], sha256('asha@example.com'));
    assert.equal(event.user_data.fn[0], sha256('asha'));
    assert.equal(event.user_data.ct[0], sha256('newdelhi'));
    assert.equal(event.user_data.zp[0], sha256('110001'));
    assert.equal(event.user_data.client_ip_address, '203.0.113.9');
    assert.equal(event.user_data.client_user_agent, browser['user-agent']);
    assert.equal(event.user_data.fbp, undefined, 'a malformed cookie is dropped');
    assert.equal(event.user_data.fbc, browserTracking.fbc);
    assert.ok(!JSON.stringify(event).includes(phone), 'the phone is only sent hashed');
    assert.deepEqual(event.custom_data, {
      currency: 'INR', value: 1069, order_id: res.body.orderId, content_type: 'product',
      content_ids: [tee], contents: [{ id: tee, quantity: 2 }], num_items: 2,
    });

    // Asking again for the same order sends nothing new.
    await api('/api/orders/retry', { cookie: merchantCookie(shop), body: { id: res.body.orderId } });
    await new Promise((resolve) => setTimeout(resolve, 200));
    assert.equal(meta.requests.length, 1);
  });

  test('nothing is sent without a token, and a Meta error never affects the order', async () => {
    const without = await trackedStore({ token: null });
    const items = [{ variantId: variant(300), quantity: 1 }];
    assert.equal((await api('/api/create-order', { body: { shop: without.shop, sessionToken: without.sessionToken, items, paymentMethod: 'COD' } })).status, 200);

    const failing = await trackedStore();
    meta.fail = true;
    const res = await api('/api/create-order', { body: { shop: failing.shop, sessionToken: failing.sessionToken, items, paymentMethod: 'COD' } });
    assert.equal(res.status, 200);
    await eventually(() => assert.equal(meta.requests.length, 1));
    assert.equal((await db.order.findUnique({ where: { id: res.body.orderId } })).orderStatus, 'Synced');
  });

  test('a paid order is sent with the browser details saved when the payment started', async () => {
    const { shop, sessionToken } = await trackedStore();
    const items = [{ variantId: variant(800), quantity: 1 }];
    const started = await api('/api/checkout/create-razorpay-order', { headers: browser, body: { shop, sessionToken, items, paymentMethod: 'PREPAID', tracking: browserTracking } });
    assert.equal(started.status, 200);
    const payment = razorpay.addPayment({ order_id: started.body.orderId, amount: started.body.amount });
    const res = await api('/api/create-order', {
      body: { shop, sessionToken, items, paymentMethod: 'PREPAID', razorpay_order_id: started.body.orderId, razorpay_payment_id: payment.id, razorpay_signature: razorpaySignature('rzp-secret', started.body.orderId, payment.id) },
    });
    assert.equal(res.status, 200);
    const [sent] = await eventually(() => { assert.equal(meta.requests.length, 1); return meta.requests; });
    const [event] = sent.body.data;
    assert.equal(event.event_id, `order_${res.body.orderId}`);
    assert.equal(event.user_data.fbp, browserTracking.fbp);
    assert.equal(event.user_data.client_ip_address, '203.0.113.9');
    assert.equal(event.event_source_url, browserTracking.sourceUrl);
    assert.equal(event.custom_data.value, 800);
  });

  test('when Shopify is down, the customer is told their order ID so the browser and server events still match', async () => {
    const { shop, sessionToken } = await trackedStore();
    const items = [{ variantId: variant(800), quantity: 1 }];
    const started = await api('/api/checkout/create-razorpay-order', { body: { shop, sessionToken, items, paymentMethod: 'PREPAID' } });
    const payment = razorpay.addPayment({ order_id: started.body.orderId, amount: started.body.amount });
    shopify.failCompletes = 3;
    const res = await api('/api/create-order', {
      body: { shop, sessionToken, items, paymentMethod: 'PREPAID', razorpay_order_id: started.body.orderId, razorpay_payment_id: payment.id, razorpay_signature: razorpaySignature('rzp-secret', started.body.orderId, payment.id) },
    });
    assert.equal(res.status, 202);
    assert.ok(res.body.orderId);
    assert.equal(meta.requests.length, 0, 'not sent until Shopify has the order');

    const retry = await api('/api/orders/retry', { cookie: merchantCookie(shop), body: { id: res.body.orderId } });
    assert.equal(retry.status, 200);
    const [sent] = await eventually(() => { assert.equal(meta.requests.length, 1); return meta.requests; });
    assert.equal(sent.body.data[0].event_id, `order_${res.body.orderId}`);
  });
});

describe('tracking in the popup', () => {
  const pages = [];
  afterEach(() => { for (const page of pages.splice(0)) page.window.close(); });

  const quote = { subtotal: 1000, discount: 0, prepaidDiscount: 0, shippingFee: 0, codFee: 69, tax: 0, total: 1069, amountDueNow: 0, amountDueLater: 1069, gifts: [], quoteToken: 'q' };
  const shop = 'tracked.myshopify.com';
  const ids = { fbPixelId: '123456789012', ga4MeasurementId: 'G-ABC123XYZ', googleAdsId: 'AW-987654321', googleAdsLabel: 'AbC-D_efG' };

  function trackedPopup(configExtra, orders = []) {
    const page = openStorefront({
      localStorage: {
        checkoutflow_verified: { phone: '9876543210', shop, sessionToken: 'session', time: Date.now() },
        cf_addrs_9876543210: [{ fname: 'Asha', lname: 'K', street: '12 MG Road', city: 'Pune', state: 'Maharashtra', pincode: '411001', phone: '9876543210' }],
      },
      overrides: {
        '/api/widget/config': () => ({ success: true, config: { checkoutPlan: 'FULL', hasRazorpay: false, codFeeAmount: 69, offers: [], ...configExtra } }),
        '/api/widget/track': () => ({ success: true }),
        '/api/customer/lookup': () => ({ success: true, customer: null }),
        '/api/checkout/quote': () => ({ success: true, cod: quote, prepaid: null, partial: null }),
        '/api/create-order': ({ body }) => { orders.push(body); return { success: true, orderId: 'ord_123' }; },
      },
      beforeLoad(window) { window.document.cookie = '_fbp=fb.1.1700000000000.555; path=/'; },
    });
    pages.push(page);
    return page;
  }
  // gtag and fbq calls, as plain arrays.
  const gtagCalls = (window) => Array.from(window.dataLayer ?? [], (args) => Array.from(args));
  const fbqCalls = (window) => Array.from(window.fbq?.queue ?? [], (args) => JSON.parse(JSON.stringify(Array.from(args))));

  test('opening, paying and ordering send matching events to GA4, Google Ads and the Meta Pixel', async () => {
    const orders = [];
    const page = trackedPopup(ids, orders);
    page.window.CheckoutFlow.open({ shop, items: [{ variantId: '4242', quantity: 2, title: 'Tee', price: 500 }] });

    await waitFor(() => page.window.document.querySelector('script[src^="https://www.googletagmanager.com/gtag/js?id=G-ABC123XYZ"]'), { message: 'gtag script' });
    const configs = gtagCalls(page.window).filter(([kind]) => kind === 'config').map(([, id, options]) => [id, options.send_page_view]);
    assert.deepEqual(configs, [['G-ABC123XYZ', false], ['AW-987654321', false]]);
    const begin = gtagCalls(page.window).find(([kind, name]) => kind === 'event' && name === 'begin_checkout');
    assert.equal(begin[2].value, 1000);
    assert.deepEqual(JSON.parse(JSON.stringify(begin[2].items)), [{ item_id: '4242', item_name: 'Tee', price: 500, quantity: 2 }]);
    assert.deepEqual(fbqCalls(page.window).find(([kind]) => kind === 'init'), ['init', '123456789012']);
    const initiate = fbqCalls(page.window).find(([, name]) => name === 'InitiateCheckout');
    assert.deepEqual(initiate[2].content_ids, ['4242']);

    await waitFor(() => page.visible('state-address-list'));
    page.click('cf-addr-sel-btn');
    await waitFor(() => page.requestsTo('/api/checkout/quote').length > 0);
    await page.window.cfExecutePayment('COD');
    await waitFor(() => orders.length === 1);
    assert.deepEqual(orders[0].tracking, { fbp: 'fb.1.1700000000000.555', sourceUrl: 'https://my-brand.example/products/tee' });

    await waitFor(() => fbqCalls(page.window).some(([, name]) => name === 'Purchase'), { message: 'Meta Purchase' });
    const purchase = fbqCalls(page.window).find(([, name]) => name === 'Purchase');
    assert.equal(purchase[2].value, 1069);
    assert.deepEqual(purchase[3], { eventID: 'order_ord_123' }, 'the same ID the server sends');
    assert.ok(fbqCalls(page.window).some(([, name]) => name === 'AddPaymentInfo'));

    const events = gtagCalls(page.window).filter(([kind]) => kind === 'event');
    const gaPurchase = events.find(([, name]) => name === 'purchase')[2];
    assert.equal(gaPurchase.transaction_id, 'ord_123');
    assert.equal(gaPurchase.value, 1069);
    assert.equal(gaPurchase.send_to, 'G-ABC123XYZ');
    const conversion = events.find(([, name]) => name === 'conversion')[2];
    assert.equal(conversion.send_to, 'AW-987654321/AbC-D_efG');
    assert.equal(conversion.transaction_id, 'ord_123');
    assert.equal(events.find(([, name]) => name === 'add_payment_info')[2].payment_type, 'COD');

    // The same order reported again (a double tap) isn't counted twice.
    await page.window.cfExecutePayment('COD');
    await waitFor(() => orders.length === 2);
    await new Promise((resolve) => setTimeout(resolve, 50));
    const purchases = gtagCalls(page.window).filter(([kind, name]) => kind === 'event' && name === 'purchase');
    assert.equal(purchases.length, 1);
    assert.equal(fbqCalls(page.window).filter(([, name]) => name === 'Purchase').length, 1);
    assert.deepEqual(page.errors, []);
  });

  test('bad or missing IDs load no tracking scripts', async () => {
    const page = trackedPopup({ fbPixelId: '12x', ga4MeasurementId: 'G-1"><img src=x>', googleAdsId: 'AW-1&x' });
    page.window.CheckoutFlow.open({ shop, items: [{ variantId: '4242', quantity: 1, title: 'Tee', price: 500 }] });
    await waitFor(() => page.visible('state-address-list'));
    assert.equal(page.window.document.querySelector('script[src*="googletagmanager"], script[src*="fbevents"]'), null);
    assert.equal(page.window.gtag, undefined);
    assert.equal(page.window.fbq, undefined);
    assert.deepEqual(page.errors, []);
  });
});
