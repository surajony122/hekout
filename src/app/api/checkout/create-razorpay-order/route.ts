import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import Razorpay from 'razorpay';
import { CheckoutError, assertExpectedTotal, isPartialCodMethod, resolvePricing } from '@/lib/checkout-pricing';
import { readCheckoutSession } from '@/lib/checkout-session';
import { orderDataFromPricing } from '@/lib/order-fulfillment';
import { planAllowsOnlinePayments, planAllowsPartialCod, planAllowsPopupOrders } from '@/lib/plans';
import { revealSecret } from '@/lib/secrets';

export async function POST(request: Request) {
  try {
    const { shop, sessionToken, items, paymentMethod, appliedCoupon, upsellVariantId, expectedTotal, quoteToken, customerName, customerEmail, address, city, state, pincode, utmSource, utmMedium, utmCampaign } = await request.json();

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

    const isPartial = typeof paymentMethod === 'string' && isPartialCodMethod(paymentMethod);
    const allowed = isPartial
      ? planAllowsPartialCod(merchant.checkoutPlan) && merchant.paymentSettings?.isPartialCodEnabled
      : planAllowsOnlinePayments(merchant.checkoutPlan);
    if (!planAllowsPopupOrders(merchant.checkoutPlan) || !allowed) {
      return NextResponse.json({ error: 'Online payments are not available for this store.' }, { status: 403 });
    }

    const keyId = merchant.paymentSettings?.razorpayKeyId?.trim();
    const keySecret = revealSecret(merchant.paymentSettings?.razorpayKeySecret)?.trim();
    if (!keyId || !keySecret) {
      return NextResponse.json({ error: 'Razorpay not configured for this merchant' }, { status: 400 });
    }

    const customer = { phone, name: customerName, email: customerEmail, address, city, state, pincode };

    const { pricing } = await resolvePricing(
      { ...merchant, accessToken: revealSecret(merchant.accessToken) ?? '' },
      {
        items,
        paymentMethod,
        quoteToken,
        couponCode: appliedCoupon?.code,
        upsellVariantId,
        customer,
      }
    );

    if (pricing.isCod) {
      return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 });
    }

    assertExpectedTotal(pricing.total, expectedTotal);

    // Razorpay can't take a payment under ₹1, for example when a coupon makes the order free.
    if (pricing.amountDueNow < 1) {
      return NextResponse.json({ error: 'This order total is too low to pay online. Please choose Cash on Delivery.' }, { status: 400 });
    }

    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });

    // Razorpay amount is in paise
    const order = await razorpay.orders.create({
      amount: Math.round(pricing.amountDueNow * 100),
      currency: pricing.currency,
      receipt: `receipt_${Date.now()}`
    });

    // Saved before the customer pays, so a dropped connection can't lose a paid order.
    await prisma.order.create({
      data: {
        ...orderDataFromPricing(merchant, pricing, customer, { source: utmSource, medium: utmMedium, campaign: utmCampaign }),
        razorpayOrderId: order.id,
        amountPaid: pricing.isPartial ? pricing.amountDueNow : null,
        orderStatus: 'Awaiting_Payment',
      },
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
