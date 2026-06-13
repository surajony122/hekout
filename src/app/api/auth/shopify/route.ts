import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const shop = url.searchParams.get('shop');

    if (!shop) {
      return NextResponse.json({ error: 'Missing shop parameter. Make sure to include ?shop=your-store.myshopify.com in the URL.' }, { status: 400 });
    }

    const clientId = process.env.SHOPIFY_CLIENT_ID;
    const host = process.env.HOST || 'http://localhost:3000';
    const redirectUri = `${host}/api/auth/callback`;
    const scopes = 'write_orders,read_orders,write_products,read_products,write_customers,read_customers';

    if (!clientId) {
      return NextResponse.json({ error: 'Server configuration error (Missing Client ID)' }, { status: 500 });
    }

    // Build the authorization URL
    const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${redirectUri}`;

    return NextResponse.redirect(authUrl);
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
