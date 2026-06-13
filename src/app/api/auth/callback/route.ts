import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const searchParams = url.searchParams;
  
  const shop = searchParams.get('shop');
  const code = searchParams.get('code');
  const hmac = searchParams.get('hmac');

  if (!shop || !code || !hmac) {
    return NextResponse.redirect(new URL('/dashboard?error=missing_params', request.url));
  }

  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
  const clientId = process.env.SHOPIFY_CLIENT_ID;

  if (!clientSecret || !clientId) {
    console.error("Missing SHOPIFY_CLIENT_SECRET or SHOPIFY_CLIENT_ID in env.");
    return NextResponse.redirect(new URL('/dashboard?error=server_config', request.url));
  }

  // 1. Verify HMAC
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

  if (generatedHash !== hmac) {
    console.error("HMAC validation failed.");
    return NextResponse.redirect(new URL('/dashboard?error=hmac_failed', request.url));
  }

  // 2. Exchange code for access token
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
      console.error("Failed to fetch access token:", tokenData);
      return NextResponse.redirect(new URL('/dashboard?error=token_exchange_failed', request.url));
    }

    const accessToken = tokenData.access_token;

    // 3. Upsert the merchant in our database with real access token
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

    // 4. Redirect to the merchant dashboard
    return NextResponse.redirect(new URL('/dashboard', request.url));
  } catch (error) {
    console.error('OAuth Callback Error:', error);
    return NextResponse.redirect(new URL('/dashboard?error=oauth_failed', request.url));
  }
}
