import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { code, discountType, discountValue, freebieName, minimumOrderValue, isAutoApply } = data;

    if (!code || !discountType) {
      return NextResponse.json({ error: 'Code and Discount Type are required' }, { status: 400 });
    }

    // MVP: Grab the first active merchant
    const merchant = await prisma.merchant.findFirst({
      where: { isActive: true }
    });

    if (!merchant) {
      return NextResponse.json({ error: 'No active merchant found' }, { status: 403 });
    }

    const coupon = await prisma.coupon.create({
      data: {
        merchantId: merchant.id,
        code: code.toUpperCase(),
        discountType,
        discountValue: discountValue ? parseFloat(discountValue) : 0,
        freebieName: freebieName || null,
        minimumOrderValue: minimumOrderValue ? parseFloat(minimumOrderValue) : 0,
        isAutoApply: !!isAutoApply,
        isActive: true
      }
    });

    return NextResponse.json({ success: true, coupon });
  } catch (error) {
    console.error('Create Discount Error:', error);
    return NextResponse.json({ error: 'Failed to create discount' }, { status: 500 });
  }
}
