import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import Razorpay from 'razorpay';
import { CheckoutError, assertExpectedTotal, priceCheckout } from '@/lib/checkout-pricing';
import { readCheckoutSession } from '@/lib/checkout-session';

export async function POST(request: Request) {
  try {
    const { shop, sessionToken, items, paymentMethod, appliedCoupon, upsellVariantId, expectedTotal, customerName, customerEmail, address, city, state, pincode } = await request.json();

    if (typeof shop !== 'string' || !shop) {
      return NextResponse.json({ error: 'Shop is required' }, { status: 400 });
    }

    const phone = readCheckoutSession(sessionToken, shop);
    if (!phone) {
      return NextResponse.json({ error: 'Please verify your phone number again.' }, { status: 401 });
    }

    const merchant = await prisma.merchant.findUnique({
      where: { shopDomain: shop },
      include: { paymentSettings: true }
    });

    if (!merchant || !merchant.isActive || !merchant.accessToken) {
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    const keyId = merchant.paymentSettings?.razorpayKeyId?.trim();
    const keySecret = merchant.paymentSettings?.razorpayKeySecret?.trim();
    if (!keyId || !keySecret) {
      return NextResponse.json({ error: 'Razorpay not configured for this merchant' }, { status: 400 });
    }

    const pricing = await priceCheckout(
      { ...merchant, accessToken: merchant.accessToken },
      {
        items,
        paymentMethod,
        couponCode: appliedCoupon?.code,
        upsellVariantId,
        customer: { phone, name: customerName, email: customerEmail, address, city, state, pincode },
      }
    );

    if (pricing.isCod) {
      return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 });
    }

    assertExpectedTotal(pricing.total, expectedTotal);

    // Razorpay can't take a payment under ₹1, for example when a coupon makes the order free.
    if (pricing.total < 1) {
      return NextResponse.json({ error: 'This order total is too low to pay online. Please choose Cash on Delivery.' }, { status: 400 });
    }

    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });

    // Razorpay amount is in paise
    const order = await razorpay.orders.create({
      amount: Math.round(pricing.total * 100),
      currency: pricing.currency,
      receipt: `receipt_${Date.now()}`
    });

    return NextResponse.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      keyId
    });

  } catch (error) {
    if (error instanceof CheckoutError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error('Create Razorpay Order Error:', error);
    return NextResponse.json({ error: 'Could not start the payment. Please try again.' }, { status: 500 });
  }
}
