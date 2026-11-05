import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { CheckoutError, priceCheckout } from '@/lib/checkout-pricing';
import { readCheckoutSession, safeEqual } from '@/lib/checkout-session';

const PAID_PAYMENT_STATUSES = ['authorized', 'captured'];

type PaymentProof = {
  razorpay_order_id?: unknown;
  razorpay_payment_id?: unknown;
  razorpay_signature?: unknown;
};

// Confirms with Razorpay that this payment is genuine and covers the order total.
async function verifyRazorpayPayment(
  settings: { razorpayKeyId: string | null; razorpayKeySecret: string | null } | null,
  proof: PaymentProof,
  expectedTotal: number
): Promise<string> {
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = proof;
  const keyId = settings?.razorpayKeyId?.trim();
  const keySecret = settings?.razorpayKeySecret?.trim();

  if (typeof orderId !== 'string' || typeof paymentId !== 'string' || typeof signature !== 'string' || !keyId || !keySecret) {
    throw new CheckoutError(402, 'Payment could not be verified.');
  }

  const expectedSignature = crypto.createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex');
  if (!safeEqual(expectedSignature, signature)) {
    throw new CheckoutError(402, 'Payment could not be verified.');
  }

  const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
  const payment = await razorpay.payments.fetch(paymentId);
  const paidEnough = Number(payment.amount) >= Math.round(expectedTotal * 100);

  if (payment.order_id !== orderId || !PAID_PAYMENT_STATUSES.includes(payment.status) || !paidEnough) {
    console.error(`Razorpay payment ${paymentId} failed verification for order ${orderId}`);
    throw new CheckoutError(402, 'Payment could not be verified. If you were charged, please contact the store.');
  }

  return paymentId;
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { shop, sessionToken, items, customerName, customerEmail, address, city, state, pincode, paymentMethod, appliedCoupon, upsellVariantId, utmSource, utmMedium, utmCampaign } = data;

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

    const pricing = await priceCheckout(
      { ...merchant, accessToken: merchant.accessToken },
      { items, paymentMethod, couponCode: appliedCoupon?.code, upsellVariantId }
    );

    const paymentId = pricing.isCod
      ? null
      : await verifyRazorpayPayment(merchant.paymentSettings, data, pricing.total);

    // The unique index on (merchantId, paymentId) stops one payment paying for two orders.
    let order;
    try {
      order = await prisma.order.create({
        data: {
          merchantId: merchant.id,
          customerName, customerPhone, customerEmail,
          address, city, state, pincode,
          productTitle: pricing.productTitle,
          variantId: pricing.firstVariantId,
          quantity: pricing.quantity,
          price: pricing.firstPrice,
          total: pricing.total,
          paymentMethod: pricing.paymentMethod,
          paymentId,
          prepaidDiscount: pricing.prepaidDiscount,
          orderStatus: 'Pending',
          utmSource: utmSource || null,
          utmMedium: utmMedium || null,
          utmCampaign: utmCampaign || null
        }
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        return NextResponse.json({ error: 'This payment has already been used for an order.' }, { status: 409 });
      }
      throw error;
    }

    if (pricing.upsell) {
      prisma.upsellFunnel.update({
        where: { id: pricing.upsell.id },
        data: { conversions: { increment: 1 }, revenue: { increment: pricing.upsell.revenue } }
      }).catch(() => {});
    }

    // Create/update the customer's local profile
    const customer = await prisma.customerProfile.findFirst({
      where: { merchantId: merchant.id, phone: customerPhone }
    });

    if (customer) {
      await prisma.customerProfile.update({
        where: { id: customer.id },
        data: { name: customerName, email: customerEmail, address, city, state, pincode, lastOrderAt: new Date() }
      });
    } else {
      await prisma.customerProfile.create({
        data: {
          merchantId: merchant.id,
          phone: customerPhone,
          name: customerName,
          email: customerEmail,
          address, city, state, pincode,
          verificationStatus: 'Verified',
          lastOrderAt: new Date()
        }
      });
    }

    // Create the Shopify draft order
    let shippingTitle = "Shipping & Handling";
    let shippingPrice = "0.00";

    if (pricing.shippingFee > 0) {
      shippingTitle = "Shipping Fee";
      shippingPrice = pricing.shippingFee.toString();
    } else if (pricing.codFee > 0) {
      shippingTitle = "Cash on Delivery Fee";
      shippingPrice = pricing.codFee.toString();
    }

    const draftPayload = {
      draft_order: {
        line_items: pricing.lineItems,
        customer: {
          first_name: customerName || undefined,
          email: customerEmail || undefined,
          // Shopify needs a country code. 10-digit numbers default to India.
          phone: customerPhone.length === 10 ? `+91${customerPhone}` : `+${customerPhone}`
        },
        shipping_address: {
          first_name: customerName || undefined,
          address1: address || undefined,
          city: city || undefined,
          province: state || undefined,
          zip: pincode || undefined,
          country: 'India'
        },
        use_customer_default_address: false,
        shipping_line: {
          title: shippingTitle,
          price: shippingPrice
        },
        applied_discount: pricing.totalDiscount > 0 ? {
          description: pricing.discountTitles.join(' + '),
          value_type: 'fixed_amount',
          value: pricing.totalDiscount.toString()
        } : undefined,
        tags: `${pricing.paymentMethod}, CheckoutFlow`,
        note: `Order via CheckoutFlow`
      }
    };

    const draftRes = await fetch(`https://${shop}/admin/api/2024-01/draft_orders.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': merchant.accessToken
      },
      body: JSON.stringify(draftPayload)
    });

    const draftData = await draftRes.json();

    if (!draftRes.ok) {
      console.error("Shopify Draft Order Error:", draftData);
      await prisma.order.update({ where: { id: order.id }, data: { orderStatus: 'Failed' }});
      return NextResponse.json({ error: 'Could not create your order. Please contact the store.' }, { status: 500 });
    }

    const shopifyDraftOrderId = draftData.draft_order.id.toString();

    // Complete the draft into a real order. COD stays unpaid; only a verified payment is marked paid.
    const completeUrl = `https://${shop}/admin/api/2024-01/draft_orders/${shopifyDraftOrderId}/complete.json${pricing.isCod ? '?payment_pending=true' : ''}`;

    const completeRes = await fetch(completeUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': merchant.accessToken
      }
    });

    const completeData = await completeRes.json();

    if (!completeRes.ok) {
      console.error("Shopify Complete Draft Error:", completeData);
      await prisma.order.update({ where: { id: order.id }, data: { shopifyDraftOrderId, orderStatus: 'Draft_Created' }});
      return NextResponse.json({ error: 'Failed to complete Shopify Draft Order' }, { status: 500 });
    }

    const shopifyOrderId = completeData.draft_order.order_id?.toString() || 'Unknown';

    // Fetch the actual order to get the Order Status URL (Thank you page)
    let orderStatusUrl = null;
    if (shopifyOrderId !== 'Unknown') {
      const orderRes = await fetch(`https://${shop}/admin/api/2024-01/orders/${shopifyOrderId}.json`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': merchant.accessToken
        }
      });
      if (orderRes.ok) {
        const orderData = await orderRes.json();
        if (orderData.order && orderData.order.order_status_url) {
          orderStatusUrl = orderData.order.order_status_url;
        }
      }
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        shopifyDraftOrderId,
        shopifyOrderId,
        orderStatus: 'Synced'
      }
    });

    return NextResponse.json({ success: true, orderId: order.id, shopifyOrderId, orderStatusUrl });
  } catch (error) {
    if (error instanceof CheckoutError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Create Order Error:', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}
