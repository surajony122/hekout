import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await request.json();
    const { code, discountValue, minimumOrderValue, maximumOrderValue, isAutoApply, isActive, isCombinable, appliesToType, applicableItemIds } = data;

    if (!code || discountValue === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const updatedCoupon = await prisma.coupon.update({
      where: { id },
      data: {
        code: code.toUpperCase(),
        discountValue,
        minimumOrderValue,
        maximumOrderValue: maximumOrderValue || null,
        isAutoApply,
        isActive,
        isCombinable,
        appliesToType,
        applicableItemIds: applicableItemIds || null
      }
    });

    return NextResponse.json({ success: true, coupon: updatedCoupon });
  } catch (error) {
    console.error('Failed to update discount:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // Toggle endpoint used by the DiscountActions list view
  try {
    const { id } = await params;
    const data = await request.json();
    const { isActive } = data;

    const updatedCoupon = await prisma.coupon.update({
      where: { id },
      data: { isActive }
    });

    return NextResponse.json({ success: true, coupon: updatedCoupon });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const merchant = await prisma.merchant.findFirst({ where: { isActive: true } });
    if (!merchant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await prisma.coupon.deleteMany({
      where: { id, merchantId: merchant.id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete discount' }, { status: 500 });
  }
}
