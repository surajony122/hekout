import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { shop, phone } = await request.json();

    if (!shop || !phone) {
      return NextResponse.json({ error: 'Shop and phone are required' }, { status: 400 });
    }

    const merchant = await prisma.merchant.findUnique({
      where: { shopDomain: shop }
    });

    if (!merchant || !merchant.isActive) {
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    // Generate 4 digit OTP
    const otpCode = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now

    await prisma.otpVerification.create({
      data: {
        merchantId: merchant.id,
        phone,
        code: otpCode,
        expiresAt
      }
    });

    // In a production app, we would integrate Twilio or Msg91 here.
    // For this MVP, we will return the OTP directly so the widget can simulate the SMS.
    
    return NextResponse.json({ 
      success: true, 
      message: 'OTP sent successfully',
      simulatedCode: otpCode // Exposing for MVP demo purposes
    });

  } catch (error) {
    console.error('Send OTP Error:', error);
    return NextResponse.json({ error: 'Failed to send OTP' }, { status: 500 });
  }
}
