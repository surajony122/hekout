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

    return NextResponse.json({
      success: true,
      config: {
        isPrepaidDiscountEnabled: ps?.isPrepaidDiscountEnabled || false,
        prepaidDiscountType: ps?.prepaidDiscountType || 'percentage',
        prepaidDiscountValue: ps?.prepaidDiscountValue || 0,
        isPartialCodEnabled: ps?.isPartialCodEnabled || false,
        partialCodAmount: ps?.partialCodAmount || 0,
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
        fbPixelId: ws?.fbPixelId || null
      }
    }, { headers: { 'Cache-Control': 'public, max-age=60' } });

  } catch (error) {
    console.error('Widget Config Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
