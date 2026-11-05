import { NextResponse } from 'next/server';
import { getLoggedInMerchant, unauthorized } from '@/lib/merchant-auth';
import { revealSecret } from '@/lib/secrets';

const LIST_COLLECTIONS = `query ListCollections {
  collections(first: 100, sortKey: TITLE) { nodes { id title } }
}`;

export async function GET() {
  try {
    const merchant = await getLoggedInMerchant();
    if (!merchant || !merchant.accessToken) return unauthorized();

    const res = await fetch(`https://${merchant.shopDomain}/admin/api/2026-07/graphql.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': revealSecret(merchant.accessToken) },
      body: JSON.stringify({ query: LIST_COLLECTIONS }),
    });
    const body = await res.json();
    if (!res.ok || !body?.data) {
      console.error('List Collections Error:', res.status, JSON.stringify(body?.errors ?? null));
      return NextResponse.json({ success: false, error: 'Could not load your collections.' }, { status: 502 });
    }
    return NextResponse.json({ success: true, collections: body.data.collections.nodes });
  } catch (error) {
    console.error('List Collections Error:', error);
    return NextResponse.json({ success: false, error: 'Could not load your collections.' }, { status: 500 });
  }
}
