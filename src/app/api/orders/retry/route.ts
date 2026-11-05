import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLoggedInMerchant, unauthorized } from '@/lib/merchant-auth';
import { fulfillOrder } from '@/lib/order-fulfillment';

export async function POST(request: Request) {
  try {
    const merchant = await getLoggedInMerchant();
    if (!merchant) return unauthorized();

    const { id } = await request.json();
    const order = typeof id === 'string'
      ? await prisma.order.findFirst({ where: { id, merchantId: merchant.id, paymentId: { not: null } } })
      : null;

    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    const result = await fulfillOrder(merchant, order.id);
    if (result.status !== 'synced') {
      return NextResponse.json({ success: false, error: 'Shopify could not take this order yet. Please try again shortly.' }, { status: 502 });
    }

    return NextResponse.json({ success: true, shopifyOrderId: result.shopifyOrderId });
  } catch (error) {
    console.error('Retry Order Error:', error);
    return NextResponse.json({ success: false, error: 'Could not retry this order.' }, { status: 500 });
  }
}
