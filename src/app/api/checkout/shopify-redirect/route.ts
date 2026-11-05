import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CheckoutError, parseItems } from '@/lib/checkout-pricing';
import { readCheckoutSession } from '@/lib/checkout-session';
import { createShopifyCheckout } from '@/lib/shopify-checkout';

export async function POST(request: Request) {
  try {
    const { shop, sessionToken, items } = await request.json();

    if (typeof shop !== 'string' || !shop) {
      return NextResponse.json({ error: 'Shop is required' }, { status: 400 });
    }

    const merchant = await prisma.merchant.findUnique({ where: { shopDomain: shop } });
    if (!merchant || !merchant.isActive || !merchant.accessToken) {
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }
    // Full Checkout completes orders in the popup. Other plans need a verified phone.
    if (merchant.checkoutPlan === 'FULL') {
      return NextResponse.json({ error: 'This store completes orders in the popup.' }, { status: 403 });
    }

    const phone = readCheckoutSession(sessionToken, shop);
    if (!phone) {
      return NextResponse.json({ error: 'Please verify your phone number again.' }, { status: 401 });
    }

    const checkoutUrl = await createShopifyCheckout(merchant, merchant.checkoutPlan, phone, parseItems(items));
    return NextResponse.json({ success: true, checkoutUrl });
  } catch (error) {
    if (error instanceof CheckoutError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Shopify Redirect Error:', error);
    return NextResponse.json({ error: 'Could not prepare your checkout.' }, { status: 502 });
  }
}
