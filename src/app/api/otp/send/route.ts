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

    // MSG91 Credentials
    const msg91AuthKey = process.env.MSG91_AUTH_KEY;
    const msg91TemplateId = process.env.MSG91_TEMPLATE_ID;

    // Twilio Credentials
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuth = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

    if (msg91AuthKey && msg91TemplateId) {
      try {
        // MSG91 expects mobile with country code but no '+' sign (e.g., 919876543210 or 19727345481)
        const cleanPhone = phone.replace(/\D/g, '');
        // Default to India (91) if 10 digits, else use as is
        const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

        const msg91Res = await fetch('https://control.msg91.com/api/v5/otp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'authkey': msg91AuthKey
          },
          body: JSON.stringify({
            template_id: msg91TemplateId,
            mobile: formattedPhone,
            otp: otpCode
          })
        });

        const msg91Data = await msg91Res.json();
        if (msg91Data.type === 'error') {
          console.error('MSG91 Error:', msg91Data);
        }
      } catch (err) {
        console.error('MSG91 Request Failed:', err);
      }
    } else if (twilioSid && twilioAuth && twilioPhone) {
      try {
        const client = twilio(twilioSid, twilioAuth);
        const cleanPhone = phone.replace(/\D/g, '');
        let formattedPhone = phone;
        if (!phone.startsWith('+')) {
          formattedPhone = cleanPhone.length === 10 ? `+91${cleanPhone}` : `+1${cleanPhone}`;
        }
        
        await client.messages.create({
          body: `Your CheckoutFlow verification code is: ${otpCode}. Valid for 5 minutes.`,
          from: twilioPhone,
          to: formattedPhone
        });
      } catch (smsError: any) {
        console.error('Twilio SMS Failed:', smsError);
        return NextResponse.json({ error: `Twilio Error: ${smsError.message}` }, { status: 400 });
      }
    } else {
      console.warn('No SMS provider credentials found in env. Falling back to simulator only.');
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
