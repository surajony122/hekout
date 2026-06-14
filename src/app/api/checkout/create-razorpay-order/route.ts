import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import Razorpay from 'razorpay';

export async function POST(request: Request) {
  try {
    const { shop, amount, currency = 'INR', receipt } = await request.json();

    if (!shop || !amount) {
      return NextResponse.json({ error: 'Shop and amount are required' }, { status: 400 });
    }

    const merchant = await prisma.merchant.findUnique({
      where: { shopDomain: shop },
      include: { paymentSettings: true }
    });

    if (!merchant || !merchant.paymentSettings?.razorpayKeyId || !merchant.paymentSettings?.razorpayKeySecret) {
      return NextResponse.json({ error: 'Razorpay not configured for this merchant' }, { status: 400 });
    }

    const razorpay = new Razorpay({
      key_id: merchant.paymentSettings.razorpayKeyId.trim(),
      key_secret: merchant.paymentSettings.razorpayKeySecret.trim()
    });

    // Razorpay amount is in paise
    const options = {
      amount: Math.round(amount * 100),
      currency,
      receipt: receipt || `receipt_${Date.now()}`
    };

    const order = await razorpay.orders.create(options);

    return NextResponse.json({ 
      success: true, 
      orderId: order.id,
      amount: order.amount,
      keyId: merchant.paymentSettings.razorpayKeyId
    });

  } catch (error: any) {
    console.error('Create Razorpay Order Error:', error);
    const errorMsg = error?.error?.description || error.message || 'Failed to create order';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
