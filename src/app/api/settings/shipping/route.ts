import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLoggedInMerchant, unauthorized } from '@/lib/merchant-auth';

export async function POST(request: Request) {
  try {
    const merchant = await getLoggedInMerchant();
    if (!merchant) return unauthorized();

    const { isShippingFeeEnabled, shippingFeeAmount, freeShippingThreshold } = await request.json();
    const fee = Number(shippingFeeAmount);
    const threshold = Number(freeShippingThreshold);

    if (!Number.isFinite(fee) || fee < 0 || !Number.isFinite(threshold) || threshold < 0) {
      return NextResponse.json({ success: false, error: 'Please enter amounts of ₹0 or more.' }, { status: 400 });
    }

    const data = { isShippingFeeEnabled: Boolean(isShippingFeeEnabled), shippingFeeAmount: fee, freeShippingThreshold: threshold };
    await prisma.paymentSettings.upsert({
      where: { merchantId: merchant.id },
      update: data,
      create: { merchantId: merchant.id, ...data },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Save Shipping Settings Error:', error);
    return NextResponse.json({ success: false, error: 'Could not save your shipping settings.' }, { status: 500 });
  }
}
