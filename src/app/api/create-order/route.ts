import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { CheckoutError, assertExpectedTotal, isCodMethod, isPartialCodMethod, resolvePricing } from '@/lib/checkout-pricing';
import { PAID_PAYMENT_STATUSES, fulfillOrder, orderDataFromPricing } from '@/lib/order-fulfillment';
import { planAllowsOnlinePayments, planAllowsPartialCod, planAllowsPopupOrders } from '@/lib/plans';
import { revealSecret } from '@/lib/secrets';
import { readCheckoutSession, safeEqual } from '@/lib/checkout-session';
import { trackingFromRequest } from '@/lib/meta-capi';

type PaymentProof = {
  razorpay_order_id?: unknown;
  razorpay_payment_id?: unknown;
  razorpay_signature?: unknown;
};

// Confirms the payment really came from Razorpay and belongs to this Razorpay order.
function verifySignature(keySecret: string | null | undefined, proof: PaymentProof) {
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = proof;

  if (typeof orderId !== 'string' || typeof paymentId !== 'string' || typeof signature !== 'string' || !keySecret) {
    throw new CheckoutError(402, 'Payment could not be verified.');
  }

  const expectedSignature = crypto.createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex');
  if (!safeEqual(expectedSignature, signature)) {
    throw new CheckoutError(402, 'Payment could not be verified.');
  }

  return { orderId, paymentId };
}

// Confirms with Razorpay that this payment went through and covers the order total.
async function verifyPaymentAmount(keyId: string, keySecret: string, orderId: string, paymentId: string, expectedTotal: number) {
  const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
  const payment = await razorpay.payments.fetch(paymentId);
  const paidEnough = Number(payment.amount) >= Math.round(expectedTotal * 100);

  if (payment.order_id !== orderId || !PAID_PAYMENT_STATUSES.includes(payment.status) || !paidEnough) {
    console.error(`Razorpay payment ${paymentId} failed verification for order ${orderId}`);
    throw new CheckoutError(402, 'Payment could not be verified. If you were charged, please contact the store.');
  }
}

async function saveCustomerProfile(
  merchantId: string,
  phone: string,
  details: { name?: string; email?: string; address?: string; city?: string; state?: string; pincode?: string }
) {
  const customer = await prisma.customerProfile.findFirst({ where: { merchantId, phone } });

  if (customer) {
    await prisma.customerProfile.update({
      where: { id: customer.id },
      data: { ...details, lastOrderAt: new Date() }
    });
  } else {
    await prisma.customerProfile.create({
      data: { merchantId, phone, ...details, verificationStatus: 'Verified', lastOrderAt: new Date() }
    });
  }
}

export async function POST(request: Request) {
  try {
    const startedAt = Date.now();
    const data = await request.json();
    const { shop, sessionToken, items, customerName, customerEmail, address, city, state, pincode, paymentMethod, appliedCoupon, upsellVariantId, expectedTotal, quoteToken, utmSource, utmMedium, utmCampaign } = data;
    const tracking = trackingFromRequest(request, data.tracking);

    if (typeof shop !== 'string' || !shop) {
      return NextResponse.json({ error: 'Shop is required' }, { status: 400 });
    }

    // The customer's phone comes from their verified session, not the request.
    const customerPhone = readCheckoutSession(sessionToken, shop);
    if (!customerPhone) {
      return NextResponse.json({ error: 'Please verify your phone number again.' }, { status: 401 });
    }

    const merchant = await prisma.merchant.findUnique({
      where: { shopDomain: shop },
      include: { paymentSettings: true }
    });

    if (!merchant || !merchant.isActive || !merchant.accessToken) {
      return NextResponse.json({ error: 'Merchant not found or missing access token' }, { status: 403 });
    }

    if (!planAllowsPopupOrders(merchant.checkoutPlan)) {
      return NextResponse.json({ error: 'This store completes orders on Shopify checkout.' }, { status: 403 });
    }

    const isPartial = typeof paymentMethod === 'string' && isPartialCodMethod(paymentMethod);
    const partialAllowed = isPartial && planAllowsPartialCod(merchant.checkoutPlan) && Boolean(merchant.paymentSettings?.isPartialCodEnabled);
    if (typeof paymentMethod === 'string' && !isCodMethod(paymentMethod) && !partialAllowed && (isPartial || !planAllowsOnlinePayments(merchant.checkoutPlan))) {
      return NextResponse.json({ error: 'Online payments are not available for this store.' }, { status: 403 });
    }

    const shopMerchant = { ...merchant, accessToken: revealSecret(merchant.accessToken) ?? '' };
    const customer = { phone: customerPhone, name: customerName, email: customerEmail, address, city, state, pincode };
    const utm = { source: utmSource, medium: utmMedium, campaign: utmCampaign };
    const isCod = typeof paymentMethod !== 'string' || isCodMethod(paymentMethod);

    let orderId: string;
    let attempts: number;

    if (isCod) {
      const { pricing } = await resolvePricing(shopMerchant, {
        items, paymentMethod, quoteToken, couponCode: appliedCoupon?.code, upsellVariantId, customer,
      });
      assertExpectedTotal(pricing.total, expectedTotal);

      const order = await prisma.order.create({
        data: { ...orderDataFromPricing(merchant, pricing, customer, utm, tracking), orderStatus: 'Pending' },
      });
      orderId = order.id;
      attempts = 2;
    } else {
      const keyId = merchant.paymentSettings?.razorpayKeyId?.trim();
      const keySecret = revealSecret(merchant.paymentSettings?.razorpayKeySecret)?.trim();
      const proof = verifySignature(keySecret, data);
      if (!keyId || !keySecret) throw new CheckoutError(402, 'Payment could not be verified.');

      // The record saved when the payment started already holds the order's exact details.
      const started =
        await prisma.order.findFirst({
          where: { merchantId: merchant.id, customerPhone, razorpayOrderId: proof.orderId, paymentId: proof.paymentId },
        }) ??
        await prisma.order.findFirst({
          where: { merchantId: merchant.id, customerPhone, razorpayOrderId: proof.orderId, paymentId: null, orderStatus: 'Awaiting_Payment' },
          orderBy: { createdAt: 'desc' },
        });

      try {
        if (started) {
          await verifyPaymentAmount(keyId, keySecret, proof.orderId, proof.paymentId, started.amountPaid ?? started.total);
          if (!started.paymentId) {
            await prisma.order.update({ where: { id: started.id }, data: { paymentId: proof.paymentId } });
          }
          orderId = started.id;
        } else {
          const { pricing } = await resolvePricing(shopMerchant, {
            items, paymentMethod, quoteToken, couponCode: appliedCoupon?.code, upsellVariantId, customer,
          });
          await verifyPaymentAmount(keyId, keySecret, proof.orderId, proof.paymentId, pricing.amountDueNow);
          const order = await prisma.order.create({
            data: {
              ...orderDataFromPricing(merchant, pricing, customer, utm, tracking),
              paymentId: proof.paymentId,
              razorpayOrderId: proof.orderId,
              amountPaid: pricing.isPartial ? pricing.amountDueNow : null,
              orderStatus: 'Pending',
            },
          });
          orderId = order.id;
        }
      } catch (error) {
        // The unique index on (merchantId, paymentId) stops one payment paying for two orders.
        if ((error as { code?: string }).code === 'P2002') {
          return NextResponse.json({ error: 'This payment has already been used for an order.' }, { status: 409 });
        }
        throw error;
      }
      attempts = 3;
    }

    // Saving the customer's local profile shouldn't make them wait for their order.
    saveCustomerProfile(merchant.id, customerPhone, { name: customerName, email: customerEmail, address, city, state, pincode })
      .catch((error) => console.error('Save Customer Profile Error:', error));

    const result = await fulfillOrder(merchant, orderId, attempts);

    console.log(`Order timing: total=${Date.now() - startedAt}ms status=${result.status} paid=${!isCod}`);

    if (result.status === 'synced') {
      return NextResponse.json({
        success: true,
        orderId: result.orderId,
        shopifyOrderId: result.shopifyOrderId,
        orderStatusUrl: result.orderStatusUrl,
      });
    }
    if (result.status === 'total_changed') {
      return NextResponse.json({ error: 'Your order total has changed. Please review it and try again.', code: 'TOTAL_CHANGED' }, { status: 409 });
    }
    if (!isCod) {
      // Their money is safe and the order is saved, so they must not be asked to pay again.
      return NextResponse.json({
        paymentReceived: true,
        orderId,
        error: 'We received your payment and are confirming your order. You do not need to pay again.',
      }, { status: 202 });
    }
    if (result.status === 'busy') {
      return NextResponse.json({ error: 'Your order is already being placed.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Could not create your order. Please try again.' }, { status: 500 });
  } catch (error) {
    if (error instanceof CheckoutError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error('Create Order Error:', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}
