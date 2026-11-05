import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createCheckoutSession, normalizePhone, safeEqual } from '@/lib/checkout-session';
import { warmCustomerLookup } from '@/lib/checkout-pricing';
import { OTP_RULES } from '@/lib/otp-rules';
import { revealSecret } from '@/lib/secrets';

const MAX_ATTEMPTS = OTP_RULES.maxAttempts;

export async function POST(request: Request) {
  try {
    const { shop, phone: rawPhone, code } = await request.json();
    const phone = normalizePhone(rawPhone);

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
        phone,
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

    // Count the attempt atomically so parallel guesses can't exceed the limit.
    const attempt = await prisma.otpVerification.updateMany({
      where: { id: verification.id, verified: false, attempts: { lt: MAX_ATTEMPTS } },
      data: { attempts: { increment: 1 } }
    });

    if (attempt.count === 0) {
      return NextResponse.json({ valid: false, error: 'Too many incorrect attempts. Please request a new OTP.' }, { status: 429 });
    }

    if (!safeEqual(verification.code, String(code))) {
      return NextResponse.json({ valid: false, error: 'Incorrect OTP code.' }, { status: 400 });
    }

    // Each code works once.
    const used = await prisma.otpVerification.updateMany({
      where: { id: verification.id, verified: false },
      data: { verified: true }
    });

    if (used.count === 0) {
      return NextResponse.json({ valid: false, error: 'OTP has already been used.' }, { status: 400 });
    }

    // Only saves time later, so it must never stop a correct code from working.
    try {
      if (merchant.accessToken) {
        warmCustomerLookup({ shopDomain: merchant.shopDomain, accessToken: revealSecret(merchant.accessToken) }, phone);
      }
    } catch (error) {
      console.error('Customer lookup was not started:', error);
    }

    return NextResponse.json({
      success: true,
      valid: true,
      sessionToken: createCheckoutSession(merchant.shopDomain, phone)
    });

  } catch (error) {
    console.error('Verify OTP Error:', error);
    return NextResponse.json({ error: 'Failed to verify OTP' }, { status: 500 });
  }
}
