import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const shop = searchParams.get('shop');

    if (!shop) {
      return NextResponse.json({ error: 'Shop domain is required' }, { status: 400 });
    }

    const merchant = await prisma.merchant.findUnique({
      where: { shopDomain: shop }
    });

    if (!merchant || !merchant.isActive) {
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    const autoDiscount = await prisma.coupon.findFirst({
      where: {
        merchantId: merchant.id,
        isActive: true,
        isAutoApply: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!autoDiscount) {
      return NextResponse.json({ success: true, discount: null });
    }

    return NextResponse.json({
      success: true,
      discount: {
        code: autoDiscount.code,
        type: autoDiscount.discountType,
        value: autoDiscount.discountValue,
        freebieName: autoDiscount.freebieName
      }
    });
  } catch (error) {
    console.error('Fetch Auto Discount Error:', error);
    return NextResponse.json({ error: 'Failed to fetch auto discount' }, { status: 500 });
  }
}
