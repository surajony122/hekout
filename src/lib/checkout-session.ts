import crypto from 'crypto';

// Issued after a customer verifies their phone by OTP. Checkout APIs read the
// phone from this signed token instead of trusting one sent by the browser.
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function signingKey(): Buffer {
  const secret = process.env.SHOPIFY_CLIENT_SECRET;
  if (!secret) throw new Error('SHOPIFY_CLIENT_SECRET is not set');
  return crypto.createHmac('sha256', secret).update('checkout-session-v1').digest();
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', signingKey()).update(payload).digest('base64url');
}

export function safeEqual(a: string, b: string): boolean {
  const left = crypto.createHash('sha256').update(a).digest();
  const right = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(left, right);
}

export function normalizePhone(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const digits = value.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

export function createCheckoutSession(shop: string, phone: string): string {
  const payload = Buffer.from(
    JSON.stringify({ shop, phone, exp: Date.now() + SESSION_TTL_MS })
  ).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

// Returns the verified phone, or null if the token is invalid, expired, or for another shop.
export function readCheckoutSession(token: unknown, shop: string): string | null {
  if (typeof token !== 'string') return null;
  const [payload, signature, ...rest] = token.split('.');
  if (!payload || !signature || rest.length > 0) return null;
  if (!safeEqual(sign(payload), signature)) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (session.shop !== shop || typeof session.exp !== 'number' || session.exp < Date.now()) {
      return null;
    }
    return typeof session.phone === 'string' ? session.phone : null;
  } catch {
    return null;
  }
}
