import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const shop = cookieStore.get('shop_domain')?.value;
    if (!shop) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const merchant = await prisma.merchant.findUnique({
      where: { shopDomain: shop }
    });

    if (!merchant) return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });

    const body = await request.json();
    const {
      razorpayKeyId,
      razorpayKeySecret,
      cashfreeAppId,
      cashfreeSecretKey,
      isPrepaidDiscountEnabled,
      prepaidDiscountType,
      prepaidDiscountValue,
      isPartialCodEnabled,
      partialCodAmount
    } = body;

    const settings = await prisma.paymentSettings.upsert({
      where: { merchantId: merchant.id },
      update: {
        razorpayKeyId,
        razorpayKeySecret,
        cashfreeAppId,
        cashfreeSecretKey,
        isPrepaidDiscountEnabled,
        prepaidDiscountType,
        prepaidDiscountValue,
        isPartialCodEnabled,
        partialCodAmount
      },
      create: {
        merchantId: merchant.id,
        razorpayKeyId,
        razorpayKeySecret,
        cashfreeAppId,
        cashfreeSecretKey,
        isPrepaidDiscountEnabled,
        prepaidDiscountType,
        prepaidDiscountValue,
        isPartialCodEnabled,
        partialCodAmount
      }
    });

    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error('Save Payment Settings Error:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
