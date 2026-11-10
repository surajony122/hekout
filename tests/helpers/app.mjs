// Runs the real, built Next.js app inside this process, so nock can answer its calls to
// Shopify, Razorpay and Twilio. Tests talk to it over HTTP like the widget and dashboard do.
import crypto from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installFakeServices } from './fake-services.mjs';
import { freePort } from './postgres.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const DIST_DIR = '.next-test';

// Made-up values. Nothing here is a real secret.
export const TEST_ENV = {
  NODE_ENV: 'production',
  NEXT_TELEMETRY_DISABLED: '1',
  NEXT_DIST_DIR: DIST_DIR,
  SHOPIFY_CLIENT_ID: 'test-client-id',
  SHOPIFY_CLIENT_SECRET: 'test-client-secret-not-real',
  SHOPIFY_REDIRECT_URI: 'https://checkoutflow.test/api/auth/callback',
  ENCRYPTION_KEY: 'test-encryption-key-not-real',
  OTP_TEST_MODE: 'true',
  PLAN_FEE_PERCENT_FULL: '2',
  PLAN_FEE_PERCENT_OTP_COD: '1',
  PLAN_FEE_PERCENT_OTP_ONLY: '0.5',
};

const SMS_ENV = ['MSG91_AUTH_KEY', 'MSG91_TEMPLATE_ID', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'];

export let baseUrl = '';
export let db = null;
let server = null;
let pool = null;

export async function startApp(databaseUrl) {
  Object.assign(process.env, TEST_ENV, { DATABASE_URL: databaseUrl });
  for (const name of SMS_ENV) delete process.env[name];

  // Must happen before Next loads, so every outbound request goes through nock.
  installFakeServices();

  const { default: next } = await import('next');
  const port = await freePort();
  const app = next({ dev: false, dir: ROOT, hostname: '127.0.0.1', port, quiet: true });
  await app.prepare();
  const handle = app.getRequestHandler();
  server = http.createServer((req, res) => handle(req, res));
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${port}`;

  const [{ PrismaClient }, { PrismaPg }, { Pool }] = await Promise.all([
    import('@prisma/client'),
    import('@prisma/adapter-pg'),
    import('pg'),
  ]);
  pool = new Pool({ connectionString: databaseUrl });
  db = new PrismaClient({ adapter: new PrismaPg(pool) });
}

export async function stopApp() {
  server?.closeAllConnections?.();
  await new Promise((resolve) => (server ? server.close(resolve) : resolve()));
  await db?.$disconnect();
  await pool?.end().catch(() => {});
}

// Sets an environment variable for one test and puts it back afterwards.
export function withEnv(t, values) {
  const before = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  t.after(() => {
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

export async function api(pathname, { method = 'POST', body, cookie, headers = {}, raw = false } = {}) {
  const res = await fetch(baseUrl + pathname, {
    method,
    redirect: 'manual',
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, body: json, text, headers: res.headers };
}

// Unique stores and phones keep tests apart, since the app caches some answers per store and phone.
let counter = 0;
const runId = crypto.randomBytes(3).toString('hex');
export const uniqueShop = (label = 'store') => `${label}-${runId}-${++counter}.myshopify.com`;
export const uniquePhone = () => `9${String(Date.now() % 1e5).padStart(5, '0')}${String(++counter).padStart(4, '0')}`.slice(0, 10);

export async function createMerchant({ plan = 'FULL', payment, widget, accessToken = 'shpat_test_token', isActive = true, shop } = {}) {
  return db.merchant.create({
    data: {
      shopDomain: shop ?? uniqueShop(),
      accessToken,
      checkoutPlan: plan,
      isActive,
      ...(payment ? { paymentSettings: { create: payment } } : {}),
      ...(widget ? { widgetSettings: { create: widget } } : {}),
    },
    include: { paymentSettings: true },
  });
}

// The same signed formats the app uses. Tests build them to check what the app accepts.
const signWith = (purpose, payload) => {
  const key = crypto.createHmac('sha256', TEST_ENV.SHOPIFY_CLIENT_SECRET).update(purpose).digest();
  return crypto.createHmac('sha256', key).update(payload).digest('base64url');
};
const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

export function signedToken(purpose, value) {
  const payload = encode(value);
  return `${payload}.${signWith(purpose, payload)}`;
}

export const checkoutSession = (shop, phone, exp = Date.now() + 60 * 60 * 1000) =>
  signedToken('checkout-session-v1', { shop, phone, exp });

export const merchantCookie = (shop, exp = Date.now() + 60 * 60 * 1000) =>
  `merchant_session=${signedToken('merchant-session-v1', { shop, exp })}`;

export function readTokenPayload(token) {
  return JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8'));
}

// What Razorpay's checkout hands the browser after a successful payment.
export function razorpaySignature(keySecret, orderId, paymentId) {
  return crypto.createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex');
}

export function shopifyWebhookHmac(body) {
  return crypto.createHmac('sha256', TEST_ENV.SHOPIFY_CLIENT_SECRET).update(body, 'utf8').digest('base64');
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Waits for work the app finishes after replying, such as counting a used discount.
export async function eventually(check, { timeout = 3000, interval = 50 } = {}) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    try {
      return await check();
    } catch (error) {
      lastError = error;
      await sleep(interval);
    }
  }
  throw lastError;
}
