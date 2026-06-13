import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { shop, phone, code } = await request.json();

    if (!shop || !phone || !code) {
      return NextResponse.json({ error: 'Shop, phone, and code are required' }, { status: 400 });
    }

    const merchant = await prisma.merchant.findUnique({
      where: { shopDomain: shop }
    });

    if (!merchant || !merchant.isActive) {
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    // Find the latest unverified OTP for this phone
    const verification = await prisma.otpVerification.findFirst({
      where: {
        merchantId: merchant.id,
        phone: phone,
        verified: false
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!verification) {
      return NextResponse.json({ valid: false, error: 'No pending OTP found for this number.' }, { status: 400 });
    }

    if (verification.expiresAt < new Date()) {
      return NextResponse.json({ valid: false, error: 'OTP has expired. Please request a new one.' }, { status: 400 });
    }

    if (verification.code !== code.toString()) {
      return NextResponse.json({ valid: false, error: 'Incorrect OTP code.' }, { status: 400 });
    }

    // Mark as verified
    await prisma.otpVerification.update({
      where: { id: verification.id },
      data: { verified: true }
    });

    return NextResponse.json({ success: true, valid: true });

  } catch (error) {
    console.error('Verify OTP Error:', error);
    return NextResponse.json({ error: 'Failed to verify OTP' }, { status: 500 });
  }
}
