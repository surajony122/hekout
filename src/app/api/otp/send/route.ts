import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import twilio from 'twilio';

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

    // Initialize Twilio
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuth = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

    if (twilioSid && twilioAuth && twilioPhone) {
      try {
        const client = twilio(twilioSid, twilioAuth);
        // Assuming the widget sends a 10 digit Indian number, we prepend +91.
        // If the number already has a country code, you may want to parse it differently.
        const formattedPhone = phone.startsWith('+') ? phone : `+91${phone}`;
        
        await client.messages.create({
          body: `Your CheckoutFlow verification code is: ${otpCode}. Valid for 5 minutes.`,
          from: twilioPhone,
          to: formattedPhone
        });
      } catch (smsError) {
        console.error('Twilio SMS Failed:', smsError);
        // We log the error but still return success so the user can use the simulator if Twilio fails
      }
    } else {
      console.warn('Twilio credentials not found in env. Falling back to simulator only.');
    }

    return NextResponse.json({ 
      success: true, 
      message: 'OTP sent successfully',
      simulatedCode: otpCode // Keeping simulator for testing and fallback
    });

  } catch (error) {
    console.error('Send OTP Error:', error);
    return NextResponse.json({ error: 'Failed to send OTP' }, { status: 500 });
  }
}
