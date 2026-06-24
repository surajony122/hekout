import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const shop = searchParams.get('shop');
  
  if (!shop) return NextResponse.json({ error: 'Shop domain required' }, { status: 400 });

  const merchant = await prisma.merchant.findUnique({ where: { shopDomain: shop } });
  if (!merchant) return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });

  const coupons = await prisma.discount.findMany({
    where: { merchantId: merchant.id, isActive: true },
    orderBy: { createdAt: 'desc' }
  });

  return NextResponse.json({ success: true, coupons });
}
