import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { safeEqual } from '@/lib/checkout-session';

// Kept free of database imports so proxy.ts can use it on every request.
export const MERCHANT_SESSION_COOKIE = 'merchant_session';
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

const SHOP_DOMAIN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

function sign(payload: string): string {
  const secret = process.env.SHOPIFY_CLIENT_SECRET;
  if (!secret) throw new Error('SHOPIFY_CLIENT_SECRET is not set');
  const key = crypto.createHmac('sha256', secret).update('merchant-session-v1').digest();
  return crypto.createHmac('sha256', key).update(payload).digest('base64url');
}

// Accepts "my-store", "my-store.myshopify.com" or a pasted store URL.
export function normalizeShopDomain(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  let shop = value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (shop && !shop.includes('.')) shop = `${shop}.myshopify.com`;
  return SHOP_DOMAIN.test(shop) ? shop : null;
}

export function createMerchantSessionToken(shop: string): string {
  const payload = Buffer.from(
    JSON.stringify({ shop, exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000 })
  ).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

// Returns the logged-in shop domain, or null if the token is invalid or expired.
export function readMerchantSessionToken(token: string | undefined): string | null {
  if (!token) return null;
  const [payload, signature, ...rest] = token.split('.');
  if (!payload || !signature || rest.length > 0) return null;
  if (!safeEqual(sign(payload), signature)) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof session.exp !== 'number' || session.exp < Date.now()) return null;
    return typeof session.shop === 'string' ? session.shop : null;
  } catch {
    return null;
  }
}

// A relative redirect, so it stays on the public site behind Render's proxy.
export function redirectTo(location: string, status = 302): NextResponse {
  return new NextResponse(null, { status, headers: { Location: location } });
}
