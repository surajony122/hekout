import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const searchParams = url.searchParams;
  
  const shop = searchParams.get('shop');
  const code = searchParams.get('code');
  const hmac = searchParams.get('hmac');

  const hostUrl = process.env.HOST || (process.env.SHOPIFY_REDIRECT_URI ? new URL(process.env.SHOPIFY_REDIRECT_URI).origin : 'http://localhost:3000');

  if (!shop || !code || !hmac) {
    return NextResponse.redirect(`${hostUrl}/dashboard?error=missing_params`);
  }

  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
  const clientId = process.env.SHOPIFY_CLIENT_ID;

  if (!clientSecret || !clientId) {
    console.error("Missing SHOPIFY_CLIENT_SECRET or SHOPIFY_CLIENT_ID in env.");
    return NextResponse.redirect(`${hostUrl}/dashboard?error=server_config`);
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
    return NextResponse.redirect(`${hostUrl}/dashboard?error=hmac_failed`);
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
      return NextResponse.redirect(`${hostUrl}/dashboard?error=token_exchange_failed`);
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
    return NextResponse.redirect(`${hostUrl}/dashboard`);
  } catch (error) {
    console.error('OAuth Callback Error:', error);
    return NextResponse.redirect(`${hostUrl}/dashboard?error=oauth_failed`);
  }
}
