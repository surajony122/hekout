import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import twilio from 'twilio';
import { normalizePhone } from '@/lib/checkout-session';

const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 30 * 1000;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 3;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_PER_DAY = 10;

export async function POST(request: Request) {
  try {
    const { shop, phone: rawPhone } = await request.json();
    const phone = normalizePhone(rawPhone);

    if (!shop || !phone) {
      return NextResponse.json({ error: 'A valid shop and phone number are required' }, { status: 400 });
    }

    const merchant = await prisma.merchant.findUnique({
      where: { shopDomain: shop }
    });

    if (!merchant || !merchant.isActive) {
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    const msg91AuthKey = process.env.MSG91_AUTH_KEY;
    const msg91TemplateId = process.env.MSG91_TEMPLATE_ID;
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuth = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER;
    const hasMsg91 = Boolean(msg91AuthKey && msg91TemplateId);
    const hasTwilio = Boolean(twilioSid && twilioAuth && twilioPhone);
    // Test mode shows the code in the browser, so it must be switched on explicitly.
    const isTestMode = process.env.OTP_TEST_MODE === 'true';

    if (!hasMsg91 && !hasTwilio && !isTestMode) {
      console.error('OTP not sent: no SMS provider configured and OTP_TEST_MODE is off.');
      return NextResponse.json({ error: 'SMS verification is not available right now.' }, { status: 503 });
    }

    const now = Date.now();
    const recent = await prisma.otpVerification.findMany({
      where: { merchantId: merchant.id, phone, createdAt: { gte: new Date(now - DAY_MS) } },
      select: { createdAt: true },
      orderBy: { createdAt: 'desc' }
    });
    const inWindow = recent.filter((otp) => otp.createdAt.getTime() >= now - WINDOW_MS).length;
    const onCooldown = recent.length > 0 && recent[0].createdAt.getTime() >= now - RESEND_COOLDOWN_MS;

    if (onCooldown || inWindow >= MAX_PER_WINDOW || recent.length >= MAX_PER_DAY) {
      return NextResponse.json({ error: 'Too many OTP requests. Please wait and try again.' }, { status: 429 });
    }

    const otpCode = crypto.randomInt(100000, 1000000).toString();

    await prisma.otpVerification.create({
      data: {
        merchantId: merchant.id,
        phone,
        code: otpCode,
        expiresAt: new Date(now + OTP_TTL_MS)
      }
    });

    if (hasMsg91) {
      // MSG91 expects the country code with no '+'. 10-digit numbers default to India.
      const res = await fetch('https://control.msg91.com/api/v5/otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'authkey': msg91AuthKey as string
        },
        body: JSON.stringify({
          template_id: msg91TemplateId,
          mobile: phone.length === 10 ? `91${phone}` : phone,
          otp: otpCode
        })
      });

      const msg91Data = await res.json().catch(() => null);
      if (!res.ok || msg91Data?.type === 'error') {
        console.error('MSG91 Error:', msg91Data);
        return NextResponse.json({ error: 'Could not send the OTP. Please try again.' }, { status: 502 });
      }
    } else if (hasTwilio) {
      try {
        await twilio(twilioSid, twilioAuth).messages.create({
          body: `Your CheckoutFlow verification code is: ${otpCode}. Valid for 5 minutes.`,
          from: twilioPhone,
          to: phone.length === 10 ? `+91${phone}` : `+${phone}`
        });
      } catch (smsError) {
        console.error('Twilio SMS Failed:', smsError);
        return NextResponse.json({ error: 'Could not send the OTP. Please try again.' }, { status: 502 });
      }
    } else {
      return NextResponse.json({
        success: true,
        message: 'OTP sent successfully (Test mode)',
        simulatedCode: otpCode
      });
    }

    return NextResponse.json({
      success: true,
      message: 'OTP sent successfully'
    });

  } catch (error) {
    console.error('Send OTP Error:', error);
    return NextResponse.json({ error: 'Failed to send OTP' }, { status: 500 });
  }
}
