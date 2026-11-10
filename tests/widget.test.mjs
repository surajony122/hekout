// The storefront popup (public/widget.js) running in jsdom.
import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ROOT, createMerchant, db, uniquePhone } from './helpers/app.mjs';
import { resetFakeServices, shopify } from './helpers/fake-services.mjs';
import { openStorefront, waitFor } from './helpers/widget.mjs';

beforeEach(() => resetFakeServices());

const pages = [];
afterEach(() => {
  for (const page of pages.splice(0)) page.window.close();
});

function storefront(options) {
  const page = openStorefront(options);
  pages.push(page);
  return page;
}

const config = (extra = {}) => ({
  success: true,
  config: { checkoutPlan: 'FULL', hasRazorpay: false, isCodFeeEnabled: true, codFeeAmount: 69, primaryColor: '#111827', offers: [], ...extra },
});

const tee = (variantId = '300001') => ({ variantId, quantity: 1, title: 'Tee', price: 500 });

describe('the built widget', () => {
  test('public/widget.js matches what build_v3.js makes from template_v3.js', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'checkoutflow-widget-'));
    try {
      for (const file of ['build_v3.js', 'gokwik-checkout-v2.html', 'new_styles.css', 'old_widget_utf8.js', 'template_v3.js']) {
        fs.copyFileSync(path.join(ROOT, file), path.join(dir, file));
      }
      fs.mkdirSync(path.join(dir, 'public'));
      execFileSync(process.execPath, ['build_v3.js'], { cwd: dir, stdio: 'ignore' });
      const built = fs.readFileSync(path.join(dir, 'public/widget.js'), 'utf8');
      const committed = fs.readFileSync(path.join(ROOT, 'public/widget.js'), 'utf8');
      assert.ok(built === committed, 'public/widget.js is out of date. Run `node build_v3.js` and commit the result.');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('loading it twice keeps one copy, and opening shows the phone step', async () => {
    const page = storefront({ overrides: { '/api/widget/config': () => config(), '/api/widget/track': () => ({ success: true }) } });
    const first = page.window.CheckoutFlow;
    page.window.eval(fs.readFileSync(path.join(ROOT, 'public/widget.js'), 'utf8'));
    assert.equal(page.window.CheckoutFlow, first);

    page.window.CheckoutFlow.open({ shop: 'any.myshopify.com', items: [tee()] });
    await waitFor(() => page.visible('state-phone'), { message: 'phone step' });
    assert.equal(page.$('cf-phone-btn').disabled, true);
    page.type('cf-phone-in', '98765abc432101');
    assert.equal(page.$('cf-phone-in').value, '9876543210');
    assert.equal(page.$('cf-phone-btn').disabled, false);
    assert.deepEqual(page.errors, []);
  });
});

describe('OTP autofill', () => {
  test('on phones with WebOTP, the code from the SMS is filled in and checked by itself', async () => {
    let releaseCode;
    const asked = [];
    const verified = [];
    const page = storefront({
      overrides: {
        '/api/widget/config': () => config(),
        '/api/widget/track': () => ({ success: true }),
        '/api/otp/send': () => ({ success: true, message: 'sent' }),
        '/api/otp/verify': ({ body }) => { verified.push(body); return { status: 400, body: { valid: false, error: 'Incorrect OTP code.' } }; },
      },
      beforeLoad(window) {
        window.OTPCredential = function OTPCredential() {};
        Object.defineProperty(window.navigator, 'credentials', {
          value: { get: (options) => { asked.push(options); return new Promise((resolve) => { releaseCode = () => resolve({ code: '482913' }); }); } },
        });
      },
    });
    page.window.CheckoutFlow.open({ shop: 'any.myshopify.com', items: [tee()] });
    await waitFor(() => page.visible('state-phone'));
    page.type('cf-phone-in', '9876543210');
    page.click('cf-phone-btn');

    await waitFor(() => asked.length === 1, { message: 'WebOTP request' });
    assert.deepEqual(JSON.parse(JSON.stringify(asked[0].otp)), { transport: ['sms'] });
    assert.ok(asked[0].signal, 'the request can be cancelled');
    assert.equal(page.$('cf-otp-in').getAttribute('autocomplete'), 'one-time-code');

    releaseCode();
    await waitFor(() => verified.length === 1, { message: 'automatic verify' });
    assert.deepEqual(verified[0], { shop: 'any.myshopify.com', phone: '9876543210', code: '482913' });
    await waitFor(() => page.$('cf-otp-err').textContent === 'Incorrect OTP code.');
    assert.deepEqual(page.errors, []);
  });

  test('without WebOTP, typing six digits checks the code', async () => {
    const verified = [];
    const page = storefront({
      overrides: {
        '/api/widget/config': () => config(),
        '/api/widget/track': () => ({ success: true }),
        '/api/otp/send': () => ({ success: true }),
        '/api/otp/verify': ({ body }) => { verified.push(body); return { status: 400, body: { error: 'Incorrect OTP code.' } }; },
      },
    });
    page.window.CheckoutFlow.open({ shop: 'any.myshopify.com', items: [tee()] });
    await waitFor(() => page.visible('state-phone'));
    page.type('cf-phone-in', '9876543210');
    page.click('cf-phone-btn');
    await waitFor(() => page.visible('cf-otp-box'));
    page.type('cf-otp-in', '12 34 56');
    await waitFor(() => verified.length === 1);
    assert.equal(verified[0].code, '123456');
  });
});

describe('store-provided text is shown safely', () => {
  test('offer titles and descriptions can\'t inject HTML', async () => {
    const offers = [
      { code: 'SAVE10', title: '<img src=x onerror="window.hacked=1">10% off', description: '<script>window.hacked=2</script>Today only' },
      { code: 'FREESHIP', title: 'Free shipping', description: null },
    ];
    const page = storefront({ overrides: { '/api/widget/config': () => config({ offers }), '/api/widget/track': () => ({ success: true }) } });
    page.window.CheckoutFlow.open({ shop: 'any.myshopify.com', items: [tee()] });
    await waitFor(() => page.visible('cpn-offers'), { message: 'offer list' });

    const list = page.$('cpn-offers');
    assert.equal(list.querySelectorAll('img, script').length, 0);
    const rows = list.querySelectorAll('button.cf-offer');
    assert.equal(rows.length, 2);
    assert.equal(rows[0].firstChild.textContent, 'SAVE10 · <img src=x onerror="window.hacked=1">10% off');
    assert.equal(rows[0].lastChild.textContent, '<script>window.hacked=2</script>Today only');
    assert.equal(rows[1].childNodes.length, 1, 'no empty description');
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(page.window.hacked, undefined);

    rows[1].click();
    assert.equal(page.$('cpn-manual-input').value, 'FREESHIP');
  });

  test('the store name is shown as text', async () => {
    const page = storefront({ overrides: { '/api/widget/config': () => config({ storeName: '<b>Brand</b>' }), '/api/widget/track': () => ({ success: true }) } });
    page.window.CheckoutFlow.open({ shop: 'any.myshopify.com', items: [tee()] });
    await waitFor(() => page.$('cf-brand')?.textContent === '<b>Brand</b>');
    assert.equal(page.$('cf-brand').querySelector('b'), null);
  });
});

describe('the bill', () => {
  test('a free gift has its own row with its value struck through, as plain text', async () => {
    const shop = 'gift-store.myshopify.com';
    const quote = {
      subtotal: 1000, discount: 0, prepaidDiscount: 0, shippingFee: 0, codFee: 69, tax: 0, total: 1069, amountDueNow: 0, amountDueLater: 1069,
      gifts: [{ title: '<b>Mug</b>', quantity: 2, value: 500 }], quoteToken: 'q',
    };
    const page = storefront({
      localStorage: {
        checkoutflow_verified: { phone: '9876543210', shop, sessionToken: 'session', time: Date.now() },
        cf_addrs_9876543210: [{ fname: 'Asha', lname: 'K', street: '12 MG Road', city: 'Pune', state: 'Maharashtra', pincode: '411001', phone: '9876543210' }],
      },
      overrides: {
        '/api/widget/config': () => config(),
        '/api/widget/track': () => ({ success: true }),
        '/api/customer/lookup': () => ({ success: true, customer: null }),
        '/api/checkout/quote': () => ({ success: true, cod: quote, prepaid: null, partial: null }),
      },
    });
    page.window.CheckoutFlow.open({ shop, items: [tee()] });
    await waitFor(() => page.visible('state-address-list'), { message: 'saved addresses' });
    page.click('cf-addr-sel-btn');

    await waitFor(() => page.$('trGift').style.display === 'flex', { message: 'gift row' });
    assert.equal(page.$('tGift').textContent, 'Free gift: <b>Mug</b> × 2');
    assert.equal(page.$('tGift').querySelector('b'), null);
    assert.equal(page.$('tGiftWas').textContent, '₹500');
    assert.equal(page.$('trDisc').style.display, 'none', 'the gift isn\'t shown again as a discount');
    assert.deepEqual(page.errors, []);
  });
});

describe('OTP + COD: payment first, then OTP', () => {
  test('a customer picks COD, verifies by OTP, adds an address and places the order', async () => {
    const merchant = await createMerchant({ plan: 'OTP_COD', payment: { isPartialCodEnabled: true, partialCodAmount: 100, razorpayKeyId: 'rzp_test', razorpayKeySecret: 'secret' } });
    shopify.variants.set('300100', { price: 500 });
    const page = storefront({ overrides: { '/api/widget/track': () => ({ success: true }) } });
    page.window.CheckoutFlow.open({ shop: merchant.shopDomain, items: [tee('300100')] });

    // 1. Ways of paying come first.
    await waitFor(() => page.visible('state-methods'), { message: 'payment methods' });
    assert.equal(page.visible('state-phone'), false);
    const methods = [...page.root().querySelectorAll('.cf-method')].map((card) => card.dataset.method);
    assert.deepEqual(methods, ['COD', 'PARTIAL COD', 'ONLINE']);
    page.click(page.root().querySelector('.cf-method[data-method="COD"]'));

    // 2. Then the phone and OTP, using the code the test-mode server hands back.
    await waitFor(() => page.visible('state-phone'));
    const phone = uniquePhone();
    page.type('cf-phone-in', phone);
    page.click('cf-phone-btn');
    const badge = await waitFor(() => page.$('cf-test-badge'), { message: 'test-mode code' });
    const code = badge.textContent.match(/\d{6}/)[0];
    page.type('cf-otp-in', code);

    // 3. A new customer adds an address.
    await waitFor(() => page.visible('state-address'), { message: 'address form', timeout: 8000 });
    assert.equal(page.$('cf-addr-phone').value, phone);
    for (const [id, value] of Object.entries({ 'cf-addr-pin': '411001', 'cf-addr-fname': 'Asha', 'cf-addr-lname': 'Kumar', 'cf-addr-street': '12 MG Road', 'cf-addr-city': 'Pune', 'cf-addr-state': 'Maharashtra' })) {
      page.$(id).value = value;
    }
    page.click('cf-addr-btn');

    // 4. Only COD is priced, and the order is placed in Shopify.
    const placeButton = await waitFor(() => page.$('cf-place-btn'), { message: 'place order button' });
    await waitFor(() => !placeButton.disabled, { message: 'total ready' });
    const quoteRequest = page.requestsTo('/api/checkout/quote').at(-1);
    assert.deepEqual(quoteRequest.body.methods, ['COD']);
    assert.equal(page.$('cf-pay-label').textContent, 'CASH ON DELIVERY');
    placeButton.click();

    await waitFor(() => page.$('successScr').style.display === 'flex', { message: 'success screen', timeout: 8000 });
    const [order] = await db.order.findMany({ where: { merchantId: merchant.id } });
    assert.equal(order.paymentMethod, 'COD');
    assert.equal(order.customerPhone, phone);
    assert.equal(order.orderStatus, 'Synced');
    assert.equal(order.total, 569);
    assert.equal(order.city, 'Pune');
    assert.equal(page.requestsTo('/api/checkout/create-razorpay-order').length, 0);
    assert.deepEqual(page.errors, []);
  });

  test('choosing Pay Online after OTP goes to a prepared Shopify checkout', async () => {
    const merchant = await createMerchant({ plan: 'OTP_COD' });
    const phone = uniquePhone();
    const page = storefront({
      overrides: {
        '/api/widget/track': () => ({ success: true }),
        '/api/otp/send': () => ({ success: true }),
        '/api/otp/verify': () => ({ success: true, sessionToken: 'session' }),
        '/api/checkout/shopify-redirect': ({ body }) => ({ success: true, checkoutUrl: `https://${body.shop}/cart/c/prepared` }),
      },
    });
    page.window.CheckoutFlow.open({ shop: merchant.shopDomain, items: [tee()] });
    await waitFor(() => page.visible('state-methods'));
    page.click(page.root().querySelector('.cf-method[data-method="ONLINE"]'));
    await waitFor(() => page.visible('state-phone'));
    page.type('cf-phone-in', phone);
    page.click('cf-phone-btn');
    await waitFor(() => page.visible('cf-otp-box'));
    page.type('cf-otp-in', '123456');
    await waitFor(() => page.requestsTo('/api/checkout/shopify-redirect').length === 1, { message: 'redirect request' });
    assert.deepEqual(page.requestsTo('/api/checkout/shopify-redirect')[0].body, { shop: merchant.shopDomain, sessionToken: 'session', items: [tee()] });
    assert.equal(page.requestsTo('/api/customer/lookup').length, 0);
  });
});
