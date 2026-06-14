import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { merchantId } = body;

    if (!merchantId) return NextResponse.json({ error: 'Merchant ID required' }, { status: 400 });

    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId }
    });

    if (!merchant) return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });

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
