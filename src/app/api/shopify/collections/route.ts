import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('shopify_app_session')?.value;
    
    // In production we verify the session properly. For MVP we use the latest merchant
    let merchant;
    if (sessionCookie) {
      merchant = await prisma.merchant.findUnique({ where: { id: sessionCookie } });
    }
    
    if (!merchant) {
      merchant = await prisma.merchant.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' }
      });
    }

    if (!merchant || !merchant.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const response = await fetch(`https://${merchant.shopDomain}/admin/api/2024-01/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': merchant.accessToken,
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
