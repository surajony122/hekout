export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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

    const autoDiscount = await prisma.coupon.findFirst({
      where: { merchantId: merchant.id, isActive: true, isAutoApply: true },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({
      success: true,
      config: {
        isPrepaidDiscountEnabled: ps?.isPrepaidDiscountEnabled || false,
        prepaidDiscountType: ps?.prepaidDiscountType || 'percentage',
        prepaidDiscountValue: ps?.prepaidDiscountValue || 0,
        isPartialCodEnabled: ps?.isPartialCodEnabled || false,
        partialCodAmount: ps?.partialCodAmount || 0,
        hasRazorpay: !!ps?.razorpayKeyId,
        storeName: merchant.storeName || shop.split('.')[0],
        primaryColor: ws?.primaryColor || '#111827',
        preLoginBannerText: ws?.preLoginBannerText || '🎉 FREE SHIPPING ON ALL ORDERS TODAY!',
        preLoginBannerBg: ws?.preLoginBannerBg || '#000000',
        preLoginBannerColor: ws?.preLoginBannerColor || '#ffffff',
        postLoginBannerText: ws?.postLoginBannerText || '⚡ EXTRA 2% OFF ON UPI/CARDS',
        postLoginBannerBg: ws?.postLoginBannerBg || '#ecfdf5',
        postLoginBannerColor: ws?.postLoginBannerColor || '#059669',
        autoDiscount: autoDiscount ? {
          code: autoDiscount.code,
          type: autoDiscount.discountType,
          value: autoDiscount.discountValue,
          freebieName: autoDiscount.freebieName
        } : null
      }
    });

  } catch (error) {
    console.error('Widget Config Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
