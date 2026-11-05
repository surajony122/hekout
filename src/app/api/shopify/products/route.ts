import { NextResponse } from 'next/server';
import { getLoggedInMerchant, unauthorized } from '@/lib/merchant-auth';
import { revealSecret } from '@/lib/secrets';

export async function GET() {
  try {
    const merchant = await getLoggedInMerchant();
    if (!merchant || !merchant.accessToken) return unauthorized();

    const res = await fetch(`https://${merchant.shopDomain}/admin/api/2024-01/products.json?fields=id,title,variants,image&limit=50`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': revealSecret(merchant.accessToken)
      }
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch products from Shopify' }, { status: 500 });
    }

    return NextResponse.json({ success: true, products: data.products });
  } catch (error) {
    console.error('Fetch Products Error:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}
