import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const shop = cookieStore.get('shop_domain')?.value;

    if (!shop) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const merchant = await prisma.merchant.findUnique({ where: { shopDomain: shop } });
    if (!merchant) return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });

    const funnels = await prisma.upsellFunnel.findMany({
      where: { merchantId: merchant.id },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ funnels });
  } catch (error) {
    console.error('Upsell API GET Error:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const shop = cookieStore.get('shop_domain')?.value;
    if (!shop) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const merchant = await prisma.merchant.findUnique({ where: { shopDomain: shop } });
    if (!merchant) return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });

    const data = await request.json();
    const { name, offerTitle, offerVariantId, offerPrice, discountType, discountValue, triggerVariantId } = data;

    const funnel = await prisma.upsellFunnel.create({
      data: {
        merchantId: merchant.id,
        name,
        offerTitle,
        offerVariantId: offerVariantId.toString(),
        offerPrice: parseFloat(offerPrice) || 0,
        discountType: discountType || 'percentage',
        discountValue: parseFloat(discountValue) || 0,
        triggerVariantId: triggerVariantId ? triggerVariantId.toString() : null,
        isActive: true
      }
    });

    return NextResponse.json({ success: true, funnel });
  } catch (error) {
    console.error('Upsell API POST Error:', error);
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const data = await request.json();
    const { id, isActive } = data;

    const funnel = await prisma.upsellFunnel.update({
      where: { id },
      data: { isActive }
    });

    return NextResponse.json({ success: true, funnel });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const data = await request.json();
    const { id } = data;

    await prisma.upsellFunnel.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
