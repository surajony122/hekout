// OTP sending limits, code checking, and Shopify webhook signatures.
import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, createMerchant, db, readTokenPayload, shopifyWebhookHmac, uniquePhone, withEnv } from './helpers/app.mjs';
import { msg91, shopify, twilio } from './helpers/fake-services.mjs';
import { resetFakeServices as resetFakes } from './helpers/fake-services.mjs';

beforeEach(() => resetFakes());

const send = (shop, phone, headers) => api('/api/otp/send', { body: { shop, phone }, headers });
const verify = (shop, phone, code) => api('/api/otp/verify', { body: { shop, phone, code } });
const minutesAgo = (minutes) => new Date(Date.now() - minutes * 60 * 1000);

// Pretends earlier codes were sent some time ago, so limits can be tested without waiting.
async function backdate(merchantId, phone, minutes) {
  await db.otpVerification.updateMany({ where: { merchantId, phone }, data: { createdAt: minutesAgo(minutes) } });
}

describe('OTP sending', () => {
  test('only valid Indian mobiles for an active store get a code', async () => {
    const merchant = await createMerchant();
    const inactive = await createMerchant({ isActive: false });
    const cases = [
      [{ shop: merchant.shopDomain, phone: '12345' }, 400],
      [{ shop: merchant.shopDomain, phone: '5123456789' }, 400],
      [{ shop: merchant.shopDomain, phone: '+1 415 555 0100' }, 400],
      [{ shop: merchant.shopDomain }, 400],
      [{ phone: '9876543210' }, 400],
      [{ shop: 'nobody.myshopify.com', phone: '9876543210' }, 404],
      [{ shop: inactive.shopDomain, phone: '9876543210' }, 404],
    ];
    for (const [body, status] of cases) {
      const res = await api('/api/otp/send', { body });
      assert.equal(res.status, status, JSON.stringify(body));
    }
    assert.equal(await db.otpVerification.count({ where: { merchantId: merchant.id } }), 0);
  });

  test('with no SMS provider and test mode off, nothing is sent', async (t) => {
    withEnv(t, { OTP_TEST_MODE: undefined });
    const merchant = await createMerchant();
    const res = await send(merchant.shopDomain, uniquePhone());
    assert.equal(res.status, 503);
  });

  test('test mode returns the code, and spaced or dashed numbers are cleaned up', async () => {
    const merchant = await createMerchant();
    const phone = uniquePhone();
    const res = await send(merchant.shopDomain, `${phone.slice(0, 5)} ${phone.slice(5, 7)}-${phone.slice(7)}`);
    assert.equal(res.status, 200);
    assert.match(res.body.simulatedCode, /^\d{6}$/);
    const saved = await db.otpVerification.findFirst({ where: { merchantId: merchant.id } });
    assert.equal(saved.phone, phone);
    assert.equal(saved.code, res.body.simulatedCode);
    assert.ok(saved.expiresAt.getTime() - Date.now() <= 5 * 60 * 1000);
  });

  test('a phone waits 30 seconds between codes, and gets at most 3 per 10 minutes and 10 per day', async () => {
    const merchant = await createMerchant();
    const phone = uniquePhone();

    assert.equal((await send(merchant.shopDomain, phone)).status, 200);
    assert.equal((await send(merchant.shopDomain, phone)).status, 429, 'resend too soon');

    await backdate(merchant.id, phone, 1);
    assert.equal((await send(merchant.shopDomain, phone)).status, 200);
    await backdate(merchant.id, phone, 1);
    assert.equal((await send(merchant.shopDomain, phone)).status, 200);
    await backdate(merchant.id, phone, 1);
    assert.equal((await send(merchant.shopDomain, phone)).status, 429, 'fourth code in 10 minutes');

    await backdate(merchant.id, phone, 11);
    assert.equal((await send(merchant.shopDomain, phone)).status, 200);

  });

  test('ten codes in a day is the most a phone can get', async () => {
    const merchant = await createMerchant();
    const phone = uniquePhone();
    await db.otpVerification.createMany({
      data: Array.from({ length: 10 }, (_, index) => ({ merchantId: merchant.id, phone, code: '111111', expiresAt: new Date(), createdAt: minutesAgo(30 + index * 60) })),
    });
    assert.equal((await send(merchant.shopDomain, phone)).status, 429);
    await db.otpVerification.updateMany({ where: { merchantId: merchant.id, phone, createdAt: { lt: minutesAgo(500) } }, data: { createdAt: minutesAgo(25 * 60) } });
    assert.equal((await send(merchant.shopDomain, phone)).status, 200);
  });

  test('one connection gets at most 5 codes per 10 minutes and 20 per day, across phones and stores', async () => {
    const merchant = await createMerchant();
    const other = await createMerchant();
    const ip = `203.0.113.${Math.floor(Math.random() * 200)}`;
    const headers = { 'cf-connecting-ip': ip };

    for (let index = 0; index < 5; index++) {
      const res = await send(index % 2 ? other.shopDomain : merchant.shopDomain, uniquePhone(), headers);
      assert.equal(res.status, 200);
    }
    assert.equal((await send(merchant.shopDomain, uniquePhone(), headers)).status, 429);
    assert.equal((await send(merchant.shopDomain, uniquePhone(), { 'cf-connecting-ip': '198.51.100.1' })).status, 200, 'other connections are unaffected');

    await db.otpVerification.updateMany({ where: { ipAddress: ip }, data: { createdAt: minutesAgo(30) } });
    await db.otpVerification.createMany({
      data: Array.from({ length: 15 }, () => ({ merchantId: merchant.id, phone: '9000000000', code: '111111', expiresAt: new Date(), ipAddress: ip, createdAt: minutesAgo(120) })),
    });
    assert.equal((await send(merchant.shopDomain, uniquePhone(), headers)).status, 429, 'daily connection cap');
  });

  test('a store sends at most 300 codes an hour', async () => {
    const merchant = await createMerchant();
    await db.otpVerification.createMany({
      data: Array.from({ length: 300 }, (_, index) => ({ merchantId: merchant.id, phone: `8${String(index).padStart(9, '0')}`, code: '111111', expiresAt: new Date(), createdAt: minutesAgo(30) })),
    });
    assert.equal((await send(merchant.shopDomain, uniquePhone())).status, 429);
    const other = await createMerchant();
    assert.equal((await send(other.shopDomain, uniquePhone())).status, 200, 'other stores are unaffected');
  });

  test('Twilio sends the code with the line Android needs to fill it in, and no code reaches the browser', async (t) => {
    withEnv(t, { TWILIO_ACCOUNT_SID: 'ACtest', TWILIO_AUTH_TOKEN: 'test-token', TWILIO_PHONE_NUMBER: '+15005550006' });
    shopify.storeHost = 'www.my-brand.in';
    const merchant = await createMerchant();
    const phone = uniquePhone();

    const res = await send(merchant.shopDomain, phone);
    assert.equal(res.status, 200);
    assert.equal(res.body.simulatedCode, undefined);
    assert.equal(twilio.messages.length, 1);
    const message = twilio.messages[0];
    const saved = await db.otpVerification.findFirst({ where: { merchantId: merchant.id, phone } });
    assert.equal(message.To, `+91${phone}`);
    assert.equal(message.From, '+15005550006');
    assert.ok(message.Body.includes(saved.code));
    assert.ok(message.Body.trimEnd().endsWith(`@www.my-brand.in #${saved.code}`), message.Body);
  });

  test('a Twilio failure is reported, not hidden', async (t) => {
    withEnv(t, { TWILIO_ACCOUNT_SID: 'ACtest', TWILIO_AUTH_TOKEN: 'test-token', TWILIO_PHONE_NUMBER: '+15005550006' });
    twilio.fail = true;
    const merchant = await createMerchant();
    const res = await send(merchant.shopDomain, uniquePhone());
    assert.equal(res.status, 502);
  });

  test('MSG91 is used first when it is set up', async (t) => {
    withEnv(t, { MSG91_AUTH_KEY: 'msg91-test', MSG91_TEMPLATE_ID: 'tpl', TWILIO_ACCOUNT_SID: 'ACtest', TWILIO_AUTH_TOKEN: 'x', TWILIO_PHONE_NUMBER: '+15005550006' });
    const merchant = await createMerchant();
    const phone = uniquePhone();
    const res = await send(merchant.shopDomain, phone);
    assert.equal(res.status, 200);
    assert.equal(res.body.simulatedCode, undefined);
    assert.equal(msg91.requests.length, 1);
    assert.equal(msg91.requests[0].mobile, `91${phone}`);
    assert.equal(twilio.messages.length, 0);
  });
});

describe('OTP checking', () => {
  test('the right code gives a session for that store and phone, and works only once', async () => {
    const merchant = await createMerchant();
    const phone = uniquePhone();
    const { body } = await send(merchant.shopDomain, phone);

    const wrong = await verify(merchant.shopDomain, phone, body.simulatedCode === '000000' ? '111111' : '000000');
    assert.equal(wrong.status, 400);
    assert.equal(wrong.body.valid, false);

    const right = await verify(merchant.shopDomain, phone, body.simulatedCode);
    assert.equal(right.status, 200);
    const session = readTokenPayload(right.body.sessionToken);
    assert.equal(session.shop, merchant.shopDomain);
    assert.equal(session.phone, phone);
    assert.ok(session.exp > Date.now() + 23 * 60 * 60 * 1000);

    const again = await verify(merchant.shopDomain, phone, body.simulatedCode);
    assert.equal(again.status, 400);
  });

  test('five wrong guesses lock the code, even for the right answer', async () => {
    const merchant = await createMerchant();
    const phone = uniquePhone();
    const { body } = await send(merchant.shopDomain, phone);
    const wrongCode = body.simulatedCode === '123456' ? '654321' : '123456';
    const guesses = await Promise.all(Array.from({ length: 8 }, () => verify(merchant.shopDomain, phone, wrongCode)));
    assert.equal(guesses.filter((res) => res.status === 400).length, 5, 'only five guesses are counted, even in parallel');
    assert.equal(guesses.filter((res) => res.status === 429).length, 3);
    const right = await verify(merchant.shopDomain, phone, body.simulatedCode);
    assert.equal(right.status, 429);
  });

  test('an expired code is refused', async () => {
    const merchant = await createMerchant();
    const phone = uniquePhone();
    const { body } = await send(merchant.shopDomain, phone);
    await db.otpVerification.updateMany({ where: { merchantId: merchant.id, phone }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const res = await verify(merchant.shopDomain, phone, body.simulatedCode);
    assert.equal(res.status, 400);
    assert.match(res.body.error, /expired/);
  });

  test('a code sent for one store doesn\'t work on another', async () => {
    const merchant = await createMerchant();
    const other = await createMerchant();
    const phone = uniquePhone();
    const { body } = await send(merchant.shopDomain, phone);
    const res = await verify(other.shopDomain, phone, body.simulatedCode);
    assert.equal(res.status, 400);
    assert.equal(res.body.sessionToken, undefined);
  });
});

describe('Shopify webhooks', () => {
  const orderPayload = (plan) => ({
    id: Math.floor(Math.random() * 1e12),
    current_total_price: '1180.00',
    note_attributes: plan ? [{ name: '_checkoutflow_plan', value: plan }] : [],
    line_items: [{ title: 'Tee', variant_id: 42, price: '590.00', quantity: 2 }],
    customer: { first_name: 'Asha', last_name: 'K', phone: '+919876543210' },
    payment_gateway_names: ['razorpay'],
  });
  const post = (body, { topic = 'orders/create', shop, hmac } = {}) => api('/api/webhooks/shopify', {
    raw: true,
    body,
    headers: {
      'Content-Type': 'application/json',
      'x-shopify-topic': topic,
      'x-shopify-shop-domain': shop,
      'x-shopify-hmac-sha256': hmac ?? shopifyWebhookHmac(body),
    },
  });

  test('a missing or wrong signature is refused', async () => {
    const merchant = await createMerchant({ plan: 'OTP_ONLY' });
    const body = JSON.stringify(orderPayload('OTP_ONLY'));
    const forged = await post(body, { shop: merchant.shopDomain, hmac: shopifyWebhookHmac(`${body} `) });
    assert.equal(forged.status, 401);
    const missing = await api('/api/webhooks/shopify', { raw: true, body, headers: { 'x-shopify-topic': 'orders/create', 'x-shopify-shop-domain': merchant.shopDomain } });
    assert.equal(missing.status, 401);
    assert.equal(await db.order.count({ where: { merchantId: merchant.id } }), 0);
  });

  test('our own Shopify-checkout orders are recorded once, with the plan\'s fee', async () => {
    const merchant = await createMerchant({ plan: 'OTP_ONLY' });
    const body = JSON.stringify(orderPayload('OTP_ONLY'));
    assert.equal((await post(body, { shop: merchant.shopDomain })).status, 200);
    assert.equal((await post(body, { shop: merchant.shopDomain })).status, 200);
    const orders = await db.order.findMany({ where: { merchantId: merchant.id } });
    assert.equal(orders.length, 1);
    assert.equal(orders[0].total, 1180);
    assert.equal(orders[0].quantity, 2);
    assert.equal(orders[0].feePercent, 0.5);
    assert.equal(orders[0].feeAmount, 5.9);
    assert.equal(orders[0].checkoutPlan, 'OTP_ONLY');
  });

  test('other orders and topics are acknowledged but not recorded', async () => {
    const merchant = await createMerchant({ plan: 'OTP_ONLY' });
    assert.equal((await post(JSON.stringify(orderPayload(null)), { shop: merchant.shopDomain })).status, 200);
    assert.equal((await post(JSON.stringify(orderPayload('NOT_A_PLAN')), { shop: merchant.shopDomain })).status, 200);
    assert.equal((await post(JSON.stringify(orderPayload('OTP_ONLY')), { shop: merchant.shopDomain, topic: 'orders/updated' })).status, 200);
    assert.equal(await db.order.count({ where: { merchantId: merchant.id } }), 0);
  });
});
