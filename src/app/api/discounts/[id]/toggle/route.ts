import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const merchant = await prisma.merchant.findFirst({ where: { isActive: true } });
    if (!merchant) return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });

    const { isActive } = await request.json();

    const coupon = await prisma.coupon.update({
      where: { id, merchantId: merchant.id },
      data: { isActive }
    });

    return NextResponse.json({ success: true, coupon });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update discount' }, { status: 500 });
  }
}
