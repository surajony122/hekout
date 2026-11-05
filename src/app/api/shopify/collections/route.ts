import { NextResponse } from 'next/server';
import { getLoggedInMerchant, unauthorized } from '@/lib/merchant-auth';
import { revealSecret } from '@/lib/secrets';

export async function GET() {
  try {
    const merchant = await getLoggedInMerchant();
    if (!merchant || !merchant.accessToken) return unauthorized();

    const response = await fetch(`https://${merchant.shopDomain}/admin/api/2024-01/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': revealSecret(merchant.accessToken),
      },
      body: JSON.stringify({
        query: `
          query {
            collections(first: 50) {
              edges {
                node {
                  id
                  title
                }
              }
            }
          }
        `
      })
    });

    const data = await response.json();

    if (data.errors) {
      console.error('GraphQL Errors:', data.errors);
      throw new Error('GraphQL Error');
    }

    const collections = data.data.collections.edges.map((edge: any) => ({
      id: edge.node.id,
      title: edge.node.title
    }));

    return NextResponse.json({ success: true, collections });
  } catch (error) {
    console.error('Failed to fetch collections:', error);
    return NextResponse.json({ error: 'Failed to fetch collections' }, { status: 500 });
  }
}
