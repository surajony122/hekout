export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { planAllowsOnlinePayments, planAllowsPartialCod } from '@/lib/plans';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const shop = searchParams.get('shop');

    if (!shop) return NextResponse.json({ error: 'Shop domain required' }, { status: 400 });

    const merchant = await prisma.merchant.findUnique({
      where: { shopDomain: shop },
      include: { paymentSettings: true, widgetSettings: true }
    });

    if (!merchant) return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });

    const ps = merchant.paymentSettings;
    const ws = merchant.widgetSettings;

    // Only what a customer may see. Limits and other rules stay on the server.
    const now = new Date();
    const offerRows = await prisma.discount.findMany({
      where: {
        merchantId: merchant.id,
        isActive: true,
        isAuto: false,
        showInCheckout: true,
        AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
      },
      select: { code: true, title: true, description: true, usageLimit: true, usageCount: true },
      take: 20,
    });
    const offers = offerRows
      .filter((offer) => offer.usageLimit === null || offer.usageCount < offer.usageLimit)
      .map(({ code, title, description }) => ({ code, title, description }));

    return NextResponse.json({
      success: true,
      config: {
        isPrepaidDiscountEnabled: ps?.isPrepaidDiscountEnabled || false,
        prepaidDiscountType: ps?.prepaidDiscountType || 'percentage',
        prepaidDiscountValue: ps?.prepaidDiscountValue || 0,
        isPartialCodEnabled: ps?.isPartialCodEnabled || false,
        partialCodAmount: ps?.partialCodAmount || 0,
        partialCodType: ps?.partialCodType || 'flat',
        offers,
        isCodFeeEnabled: ps?.isCodFeeEnabled !== false, // default true
        codFeeAmount: ps?.codFeeAmount !== undefined ? ps?.codFeeAmount : 69,
        isShippingFeeEnabled: ps?.isShippingFeeEnabled || false,
        shippingFeeAmount: ps?.shippingFeeAmount !== undefined ? ps?.shippingFeeAmount : 0,
        freeShippingThreshold: ps?.freeShippingThreshold !== undefined ? ps?.freeShippingThreshold : 999,
        checkoutPlan: merchant.checkoutPlan,
        hasPartialCod: planAllowsPartialCod(merchant.checkoutPlan) && Boolean(ps?.isPartialCodEnabled) && (ps?.partialCodAmount ?? 0) > 0 && !!ps?.razorpayKeyId,
        hasRazorpay: planAllowsOnlinePayments(merchant.checkoutPlan) && !!ps?.razorpayKeyId,
        storeName: merchant.storeName || shop.split('.')[0],
        brandLogoUrl: ws?.brandLogoUrl || '',
        primaryColor: ws?.primaryColor || '#111827',
        preLoginBannerText: ws?.preLoginBannerText || '',
        preLoginBannerBg: ws?.preLoginBannerBg || '#000000',
        preLoginBannerColor: ws?.preLoginBannerColor || '#ffffff',
        postLoginBannerText: ws?.postLoginBannerText || '',
        postLoginBannerBg: ws?.postLoginBannerBg || '#ecfdf5',
        postLoginBannerColor: ws?.postLoginBannerColor || '#059669',
        fbPixelId: ws?.fbPixelId || null,
        // Public IDs only. The Meta token stays on the server.
        ga4MeasurementId: ws?.ga4MeasurementId || null,
        googleAdsId: ws?.googleAdsId || null,
        googleAdsLabel: ws?.googleAdsLabel || null,
      }
    }, { headers: { 'Cache-Control': 'public, max-age=60' } });

  } catch (error) {
    console.error('Widget Config Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
