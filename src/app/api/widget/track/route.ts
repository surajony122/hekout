import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const { shop, sessionId, eventName } = await request.json();

    if (!shop || !eventName) {
      return NextResponse.json({ error: 'Shop and eventName are required' }, { status: 400, headers: corsHeaders });
    }

    const merchant = await prisma.merchant.findUnique({
      where: { shopDomain: shop }
    });

    if (!merchant) {
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404, headers: corsHeaders });
    }

    await prisma.analyticsEvent.create({
      data: {
        merchantId: merchant.id,
        sessionId: sessionId || 'anonymous',
        eventName: eventName
      }
    });

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    console.error('Analytics Track Error:', error);
    return NextResponse.json({ error: 'Failed to track event' }, { status: 500, headers: corsHeaders });
  }
}
