import crypto from 'crypto';
import { normalizeShopDomain, redirectTo } from '@/lib/merchant-session';

const OAUTH_STATE_COOKIE = 'shopify_oauth_state';

export async function GET(request: Request) {
  const shop = normalizeShopDomain(new URL(request.url).searchParams.get('shop'));
  if (!shop) return redirectTo('/login?error=invalid_shop');

  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const host = process.env.HOST || 'http://localhost:3000';
  const redirectUri = process.env.SHOPIFY_REDIRECT_URI || `${host}/api/auth/callback`;
  const scopes = 'write_orders,read_orders,write_products,read_products,write_customers,read_customers,read_discounts,write_discounts,read_price_rules,write_price_rules';

  if (!clientId) {
    console.error('Missing SHOPIFY_CLIENT_ID in env.');
    return redirectTo('/login?error=server_config');
  }

  // A random value tied to this browser, checked in the callback to stop forged logins.
  const state = crypto.randomBytes(24).toString('hex');
  const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${encodeURIComponent(clientId)}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

  const response = redirectTo(authUrl);
  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: 10 * 60,
  });
  return response;
}
