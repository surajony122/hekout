import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const shop = searchParams.get('shop');
  const code = searchParams.get('code');
  const hmac = searchParams.get('hmac');

  if (!shop || !code) {
    return NextResponse.redirect(new URL('/dashboard?error=missing_params', request.url));
  }

  try {
    const clientId = process.env.SHOPIFY_CLIENT_ID || 'mock_client_id';
    const clientSecret = process.env.SHOPIFY_CLIENT_SECRET || 'mock_client_secret';

    // In a real app, you would exchange the code for an access token:
    // const response = await fetch(`https://${shop}/admin/oauth/access_token`, { ... });
    // const { access_token } = await response.json();
    
    // For this MVP blueprint, we will mock the access token exchange
    const accessToken = 'shpua_' + Math.random().toString(36).substring(2, 15);

    // Upsert the merchant in our database
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

    // Redirect to the merchant dashboard
    return NextResponse.redirect(new URL('/dashboard', request.url));
  } catch (error) {
    console.error('OAuth Callback Error:', error);
    return NextResponse.redirect(new URL('/dashboard?error=oauth_failed', request.url));
  }
}
