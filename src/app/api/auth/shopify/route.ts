import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { shop } = await request.json();

    if (!shop) {
      return NextResponse.json({ error: 'Missing shop parameter' }, { status: 400 });
    }

    const clientId = process.env.SHOPIFY_CLIENT_ID || 'mock_client_id';
    const redirectUri = process.env.SHOPIFY_REDIRECT_URI || 'http://localhost:3000/api/auth/callback';
    const scopes = 'write_orders,read_orders,write_products,read_products,write_customers,read_customers';

    // Build the authorization URL
    const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${redirectUri}`;

    return NextResponse.json({ authUrl });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
