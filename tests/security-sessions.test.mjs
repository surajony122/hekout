// Customer checkout sessions and merchant logins.
import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  TEST_ENV, api, checkoutSession, createMerchant, db, merchantCookie, readTokenPayload, signedToken, uniquePhone, uniqueShop,
} from './helpers/app.mjs';
import { shopify } from './helpers/fake-services.mjs';
import { resetFakeServices as resetFakes } from './helpers/fake-services.mjs';

beforeEach(() => resetFakes());

const items = [{ variantId: '7001', quantity: 1 }];

describe('checkout session tokens', () => {
  const customerRoutes = [
    ['/api/checkout/quote', { items }],
    ['/api/create-order', { items, paymentMethod: 'COD' }],
    ['/api/checkout/create-razorpay-order', { items, paymentMethod: 'PREPAID' }],
    ['/api/customer/lookup', {}],
  ];

  test('a correct token is accepted', async () => {
    const merchant = await createMerchant();
    shopify.variants.set('7001', { price: 100 });
    const res = await api('/api/checkout/quote', { body: { shop: merchant.shopDomain, sessionToken: checkoutSession(merchant.shopDomain, uniquePhone()), items } });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
  });

  for (const [route, extra] of customerRoutes) {
    test(`${route} rejects missing, forged, expired and other-store tokens`, async () => {
      const merchant = await createMerchant();
      const other = await createMerchant();
      const shop = merchant.shopDomain;
      const phone = uniquePhone();
      const good = checkoutSession(shop, phone);
      const [payload] = good.split('.');
      const swappedPhone = Buffer.from(JSON.stringify({ ...readTokenPayload(good), phone: '9999999999' })).toString('base64url');
      const wrongKey = crypto.createHmac('sha256', 'another-secret').update(payload).digest('base64url');

      const bad = {
        missing: undefined,
        notAString: { phone },
        garbage: 'abc',
        extraPart: `${good}.x`,
        tamperedPayload: `${swappedPhone}.${good.split('.')[1]}`,
        wrongKey: `${payload}.${wrongKey}`,
        expired: checkoutSession(shop, phone, Date.now() - 1000),
        otherStore: checkoutSession(other.shopDomain, phone),
        merchantCookieInstead: signedToken('merchant-session-v1', { shop, phone, exp: Date.now() + 60000 }),
      };
      for (const [name, sessionToken] of Object.entries(bad)) {
        const res = await api(route, { body: { shop, sessionToken, ...extra } });
        assert.equal(res.status, 401, `${name} should be refused by ${route}`);
      }
      assert.equal(await db.order.count({ where: { merchantId: merchant.id } }), 0);
    });
  }

  test('the phone comes from the token, never the request', async () => {
    const merchant = await createMerchant();
    const verified = uniquePhone();
    const victim = uniquePhone();
    await db.customerProfile.create({ data: { merchantId: merchant.id, phone: victim, name: 'Victim', address: '1 Secret Lane' } });
    await db.customerProfile.create({ data: { merchantId: merchant.id, phone: verified, name: 'Me', address: '2 My Road' } });

    const res = await api('/api/customer/lookup', { body: { shop: merchant.shopDomain, sessionToken: checkoutSession(merchant.shopDomain, verified), phone: victim } });
    assert.equal(res.status, 200);
    assert.equal(res.body.customer.name, 'Me');
  });
});

describe('merchant login', () => {
  test('dashboard APIs need a login, and pages send visitors to the login screen', async () => {
    const res = await api('/api/dashboard/metrics', { method: 'GET' });
    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'Please log in.');

    const page = await api('/orders', { method: 'GET' });
    assert.equal(page.status, 307);
    assert.equal(page.headers.get('location'), 'https://checkoutflow.test/login');
  });

  test('public checkout routes stay open without a login', async () => {
    const merchant = await createMerchant();
    const res = await api(`/api/widget/config?shop=${merchant.shopDomain}`, { method: 'GET' });
    assert.equal(res.status, 200);
  });

  test('forged, expired and malformed cookies are refused', async () => {
    const merchant = await createMerchant();
    const shop = merchant.shopDomain;
    const valid = merchantCookie(shop).split('=')[1];
    const [payload, signature] = valid.split('.');
    const otherShopPayload = Buffer.from(JSON.stringify({ shop: uniqueShop(), exp: Date.now() + 60000 })).toString('base64url');
    const cookies = {
      expired: merchantCookie(shop, Date.now() - 1000),
      wrongKey: `merchant_session=${payload}.${crypto.createHmac('sha256', 'nope').update(payload).digest('base64url')}`,
      swappedShop: `merchant_session=${otherShopPayload}.${signature}`,
      checkoutTokenInstead: `merchant_session=${checkoutSession(shop, '9876543210')}`,
      noSignature: `merchant_session=${payload}`,
      extraPart: `merchant_session=${valid}.x`,
    };
    for (const [name, cookie] of Object.entries(cookies)) {
      const res = await api('/api/settings/plan', { cookie, body: { plan: 'OTP_COD' } });
      assert.equal(res.status, 401, `${name} cookie should be refused`);
    }
    assert.equal((await db.merchant.findUnique({ where: { id: merchant.id } })).checkoutPlan, 'FULL');
  });

  test('a valid cookie works, but not for a store that was switched off', async () => {
    const merchant = await createMerchant();
    const ok = await api('/api/settings/plan', { cookie: merchantCookie(merchant.shopDomain), body: { plan: 'OTP_COD' } });
    assert.equal(ok.status, 200);

    await db.merchant.update({ where: { id: merchant.id }, data: { isActive: false } });
    const off = await api('/api/settings/plan', { cookie: merchantCookie(merchant.shopDomain), body: { plan: 'FULL' } });
    assert.equal(off.status, 401);
  });

  test('opening the app for another store starts that store\'s login', async () => {
    const merchant = await createMerchant();
    const res = await api(`/?shop=${uniqueShop('other')}`, { method: 'GET', cookie: merchantCookie(merchant.shopDomain) });
    assert.equal(res.status, 307);
    assert.match(res.headers.get('location'), /^https:\/\/checkoutflow\.test\/api\/auth\/shopify\?shop=other-/);
  });

  test('the Shopify login checks state and HMAC, then signs the merchant in', async () => {
    const shop = uniqueShop('login');

    const bad = await api('/api/auth/shopify?shop=not a shop', { method: 'GET' });
    assert.equal(bad.headers.get('location'), '/login?error=invalid_shop');

    const start = await api(`/api/auth/shopify?shop=${shop}`, { method: 'GET' });
    assert.equal(start.status, 302);
    const authorize = new URL(start.headers.get('location'));
    assert.equal(authorize.host, shop);
    const state = authorize.searchParams.get('state');
    const stateCookie = start.headers.getSetCookie().find((cookie) => cookie.startsWith('shopify_oauth_state='));
    assert.match(stateCookie, /HttpOnly/i);
    assert.ok(stateCookie.includes(state));

    const params = { code: 'auth-code', shop, state, timestamp: '1700000000' };
    const message = Object.keys(params).sort().map((key) => `${key}=${params[key]}`).join('&');
    const hmac = crypto.createHmac('sha256', TEST_ENV.SHOPIFY_CLIENT_SECRET).update(message).digest('hex');
    const query = (extra) => new URLSearchParams({ ...params, ...extra }).toString();

    const noState = await api(`/api/auth/callback?${query({ hmac })}`, { method: 'GET' });
    assert.equal(noState.headers.get('location'), '/login?error=invalid_state');

    const cookie = `shopify_oauth_state=${state}`;
    const wrongState = await api(`/api/auth/callback?${query({ hmac, state: 'x'.repeat(48) })}`, { method: 'GET', cookie });
    assert.equal(wrongState.headers.get('location'), '/login?error=invalid_state');

    const badHmac = await api(`/api/auth/callback?${query({ hmac: '0'.repeat(64) })}`, { method: 'GET', cookie });
    assert.equal(badHmac.headers.get('location'), '/login?error=hmac_failed');
    assert.equal(await db.merchant.count({ where: { shopDomain: shop } }), 0);

    const done = await api(`/api/auth/callback?${query({ hmac })}`, { method: 'GET', cookie });
    assert.equal(done.headers.get('location'), '/');
    const session = done.headers.getSetCookie().find((value) => value.startsWith('merchant_session='));
    assert.match(session, /HttpOnly/i);

    const merchant = await db.merchant.findUnique({ where: { shopDomain: shop } });
    assert.ok(merchant.accessToken.startsWith('enc:v1:'), 'the access token is stored encrypted');
    assert.ok(!merchant.accessToken.includes('shpat_'));

    const loggedIn = await api('/api/settings/plan', { cookie: session.split(';')[0], body: { plan: 'OTP_COD' } });
    assert.equal(loggedIn.status, 200);

    const logout = await api('/api/auth/logout', {});
    assert.equal(logout.status, 303);
    assert.match(logout.headers.getSetCookie().join(';'), /merchant_session=;/);
  });
});
