import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLoggedInMerchant, unauthorized } from '@/lib/merchant-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const merchant = await getLoggedInMerchant();
    if (!merchant) return unauthorized();

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
    const merchant = await getLoggedInMerchant();
    if (!merchant) return unauthorized();

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
    const merchant = await getLoggedInMerchant();
    if (!merchant) return unauthorized();

    const { id, isActive } = await request.json();

    const updated = await prisma.upsellFunnel.updateMany({
      where: { id, merchantId: merchant.id },
      data: { isActive: Boolean(isActive) }
    });
    if (updated.count === 0) {
      return NextResponse.json({ error: 'Upsell not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Upsell API PATCH Error:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const merchant = await getLoggedInMerchant();
    if (!merchant) return unauthorized();

    const { id } = await request.json();

    const deleted = await prisma.upsellFunnel.deleteMany({
      where: { id, merchantId: merchant.id }
    });
    if (deleted.count === 0) {
      return NextResponse.json({ error: 'Upsell not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Upsell API DELETE Error:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
