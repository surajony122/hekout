import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const data = await request.json();
    const { code, discountValue, isAutoApply, isActive } = data;

    if (!code || discountValue === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const updatedCoupon = await prisma.coupon.update({
      where: { id: params.id },
      data: {
        code: code.toUpperCase(),
        discountValue,
        isAutoApply,
        isActive
      }
    });

    return NextResponse.json({ success: true, coupon: updatedCoupon });
  } catch (error) {
    console.error('Failed to update discount:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  // Toggle endpoint used by the DiscountActions list view
  try {
    const data = await request.json();
    const { isActive } = data;

    const updatedCoupon = await prisma.coupon.update({
      where: { id: params.id },
      data: { isActive }
    });

    return NextResponse.json({ success: true, coupon: updatedCoupon });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
