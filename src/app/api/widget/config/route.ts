export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const shop = searchParams.get('shop');

    if (!shop) return NextResponse.json({ error: 'Shop domain required' }, { status: 400 });

    const merchant = await prisma.merchant.findUnique({
      where: { shopDomain: shop },
      include: { paymentSettings: true }
    });

    if (!merchant) return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });

    const ps = merchant.paymentSettings;

    return NextResponse.json({
      success: true,
      config: {
        isPrepaidDiscountEnabled: ps?.isPrepaidDiscountEnabled || false,
        prepaidDiscountType: ps?.prepaidDiscountType || 'percentage',
        prepaidDiscountValue: ps?.prepaidDiscountValue || 0,
        isPartialCodEnabled: ps?.isPartialCodEnabled || false,
        partialCodAmount: ps?.partialCodAmount || 0,
        hasRazorpay: !!ps?.razorpayKeyId,
        storeName: merchant.storeName || shop.split('.')[0]
      }
    });

  } catch (error) {
    console.error('Widget Config Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
