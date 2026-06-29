import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const shop = searchParams.get('shop');
    const variantId = searchParams.get('variantId');

    if (!shop || !variantId) {
      return NextResponse.json({ error: 'Missing shop or variantId' }, { status: 400 });
    }

    const merchant = await prisma.merchant.findUnique({
      where: { shopDomain: shop }
    });

    if (!merchant) {
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    // Find an active upsell funnel for this variant (or a global one)
    const upsell = await prisma.upsellFunnel.findFirst({
      where: {
        merchantId: merchant.id,
        isActive: true,
        OR: [
          { triggerVariantId: variantId },
          { triggerVariantId: null }
        ]
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!upsell) {
      return NextResponse.json({ active: false });
    }

    // Fire and forget impression tracking
    prisma.upsellFunnel.update({
      where: { id: upsell.id },
      data: { impressions: { increment: 1 } }
    }).catch(console.error);

    let finalPrice = upsell.offerPrice;
    if (upsell.discountType === 'percentage') {
      finalPrice = finalPrice - (finalPrice * (upsell.discountValue / 100));
    } else {
      finalPrice = finalPrice - upsell.discountValue;
    }

    return NextResponse.json({
      active: true,
      offer: {
        id: upsell.id,
        variantId: upsell.offerVariantId,
        title: upsell.offerTitle,
        originalPrice: upsell.offerPrice,
        price: Math.max(0, finalPrice), // Ensure price doesn't go below 0
        discountType: upsell.discountType,
        discountValue: upsell.discountValue
      }
    });

  } catch (error) {
    console.error('Upsell API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
