import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLoggedInMerchant, unauthorized } from '@/lib/merchant-auth';
import { isEncryptionConfigured, protectSecret } from '@/lib/secrets';

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
    } = body;

    const newSecrets = [razorpayKeySecret, cashfreeSecretKey].some((value) => typeof value === 'string' && value.trim());
    if (newSecrets && !isEncryptionConfigured()) {
      console.error('Payment keys were not saved because ENCRYPTION_KEY is not set.');
      return NextResponse.json({ error: 'Secure key storage is not set up yet, so your keys were not saved.' }, { status: 503 });
    }

    // A blank secret keeps the saved one. Removing the Key ID disconnects Razorpay.
    const keyId = typeof razorpayKeyId === 'string' ? razorpayKeyId.trim() : '';
    const secretFields = {
      ...(typeof razorpayKeySecret === 'string' && razorpayKeySecret.trim()
        ? { razorpayKeySecret: protectSecret(razorpayKeySecret.trim()) }
        : keyId ? {} : { razorpayKeySecret: '' }),
      ...(typeof cashfreeSecretKey === 'string' && cashfreeSecretKey.trim()
        ? { cashfreeSecretKey: protectSecret(cashfreeSecretKey.trim()) }
        : {}),
    };

    await prisma.paymentSettings.upsert({
      where: { merchantId: merchant.id },
      update: {
        razorpayKeyId: keyId,
        ...secretFields,
        cashfreeAppId,
        isPrepaidDiscountEnabled,
        prepaidDiscountType,
        prepaidDiscountValue,
        isPartialCodEnabled,
        partialCodAmount,
        isCodFeeEnabled,
        codFeeAmount,
      },
      create: {
        merchantId: merchant.id,
        razorpayKeyId: keyId,
        ...secretFields,
        cashfreeAppId,
        isPrepaidDiscountEnabled,
        prepaidDiscountType,
        prepaidDiscountValue,
        isPartialCodEnabled,
        partialCodAmount,
        isCodFeeEnabled,
        codFeeAmount,
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Save Payment Settings Error:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
