import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const merchant = await prisma.merchant.findFirst({
      where: { isActive: true }
    });

    if (!merchant || !merchant.accessToken) {
      return NextResponse.json({ error: 'Merchant not found or not authenticated' }, { status: 403 });
    }

    const res = await fetch(`https://${merchant.shopDomain}/admin/api/2024-01/products.json?fields=id,title,variants,image&limit=50`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': merchant.accessToken
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
