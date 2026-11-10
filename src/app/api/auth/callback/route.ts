import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { safeEqual } from '@/lib/checkout-session';
import { protectSecret } from '@/lib/secrets';
import { ensureOrderWebhooks } from '@/lib/shopify-order-sync';
import {
  MERCHANT_SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  createMerchantSessionToken,
  normalizeShopDomain,
  redirectTo,
} from '@/lib/merchant-session';

const OAUTH_STATE_COOKIE = 'shopify_oauth_state';

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;

  const shop = normalizeShopDomain(searchParams.get('shop'));
  const code = searchParams.get('code');
  const hmac = searchParams.get('hmac');
  const state = searchParams.get('state');

  if (!shop || !code || !hmac || !state) {
    return redirectTo('/login?error=missing_params');
  }

  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
  const clientId = process.env.SHOPIFY_CLIENT_ID;

  if (!clientSecret || !clientId) {
    console.error("Missing SHOPIFY_CLIENT_SECRET or SHOPIFY_CLIENT_ID in env.");
    return redirectTo('/login?error=server_config');
  }

  // 1. This browser must be the one that started the login
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  if (!expectedState || !safeEqual(expectedState, state)) {
    console.error("OAuth state validation failed.");
    return redirectTo('/login?error=invalid_state');
  }

  // 2. The request must really come from Shopify
  const paramsObj = Object.fromEntries(searchParams.entries());
  delete paramsObj['hmac'];
  const message = Object.keys(paramsObj)
    .sort()
    .map(key => `${key}=${paramsObj[key]}`)
    .join('&');

  const generatedHash = crypto
    .createHmac('sha256', clientSecret)
    .update(message)
    .digest('hex');

  if (!safeEqual(generatedHash, hmac)) {
    console.error("HMAC validation failed.");
    return redirectTo('/login?error=hmac_failed');
  }

  // 3. Exchange code for access token
  try {
    const accessTokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: code
      })
    });

    const tokenData = await accessTokenResponse.json();

    if (!accessTokenResponse.ok || !tokenData.access_token) {
      console.error("Failed to fetch access token, status:", accessTokenResponse.status);
      return redirectTo('/login?error=token_exchange_failed');
    }

    const accessToken = protectSecret(tokenData.access_token);

    // 4. Upsert the merchant in our database with real access token
    await prisma.merchant.upsert({
      where: { shopDomain: shop },
      update: {
        accessToken: accessToken,
        isActive: true,
      },
      create: {
        shopDomain: shop,
        accessToken: accessToken,
        isActive: true,
        plan: 'free',
      },
    });

    // So Shopify tells us when an order is cancelled, refunded or fulfilled. Login doesn't wait for it.
    ensureOrderWebhooks({ shopDomain: shop, accessToken }).catch(() => {});

    // 5. Log the merchant in and open their dashboard
    const response = redirectTo('/');
    response.cookies.set(MERCHANT_SESSION_COOKIE, createMerchantSessionToken(shop), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    response.cookies.delete({ name: OAUTH_STATE_COOKIE, path: '/api/auth' });
    return response;
  } catch (error) {
    console.error('OAuth Callback Error:', error);
    return redirectTo('/login?error=oauth_failed');
  }
}
