import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { shop, sessionId, eventName } = await request.json();

    if (!shop || !eventName) {
      return NextResponse.json({ error: 'Shop and eventName are required' }, { status: 400 });
    }

    const merchant = await prisma.merchant.findUnique({
      where: { shopDomain: shop }
    });

    if (!merchant) {
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    await prisma.analyticsEvent.create({
      data: {
        merchantId: merchant.id,
        sessionId: sessionId || 'anonymous',
        eventName: eventName
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Analytics Track Error:', error);
    return NextResponse.json({ error: 'Failed to track event' }, { status: 500 });
  }
}
