import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLoggedInMerchant, unauthorized } from '@/lib/merchant-auth';

export async function POST(request: Request) {
  try {
    const merchant = await getLoggedInMerchant();
    if (!merchant) return unauthorized();

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
      partialCodAmount,
      isCodFeeEnabled,
      codFeeAmount,
      isShippingFeeEnabled,
      shippingFeeAmount,
      freeShippingThreshold
    } = body;

    const settings = await prisma.paymentSettings.upsert({
      where: { merchantId: merchant.id },
      update: {
        razorpayKeyId: razorpayKeyId?.trim() || '',
        razorpayKeySecret: razorpayKeySecret?.trim() || '',
        cashfreeAppId,
        cashfreeSecretKey,
        isPrepaidDiscountEnabled,
        prepaidDiscountType,
        prepaidDiscountValue,
        isPartialCodEnabled,
        partialCodAmount,
        isCodFeeEnabled,
        codFeeAmount,
        isShippingFeeEnabled,
        shippingFeeAmount: shippingFeeAmount !== undefined ? parseFloat(shippingFeeAmount) : 0,
        freeShippingThreshold: freeShippingThreshold !== undefined ? parseFloat(freeShippingThreshold) : 999
      },
      create: {
        merchantId: merchant.id,
        razorpayKeyId: razorpayKeyId?.trim() || '',
        razorpayKeySecret: razorpayKeySecret?.trim() || '',
        cashfreeAppId,
        cashfreeSecretKey,
        isPrepaidDiscountEnabled,
        prepaidDiscountType,
        prepaidDiscountValue,
        isPartialCodEnabled,
        partialCodAmount,
        isCodFeeEnabled,
        codFeeAmount,
        isShippingFeeEnabled,
        shippingFeeAmount: shippingFeeAmount !== undefined ? parseFloat(shippingFeeAmount) : 0,
        freeShippingThreshold: freeShippingThreshold !== undefined ? parseFloat(freeShippingThreshold) : 999
      }
    });

    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error('Save Payment Settings Error:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
