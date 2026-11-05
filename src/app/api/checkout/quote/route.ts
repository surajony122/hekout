import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CheckoutError, createQuoteToken, quoteCheckout } from '@/lib/checkout-pricing';
import { readCheckoutSession } from '@/lib/checkout-session';
import { reconcileInBackground } from '@/lib/order-fulfillment';
import { revealSecret } from '@/lib/secrets';
import { planAllowsPartialCod, planAllowsPopupOrders } from '@/lib/plans';

type Quote = NonNullable<Awaited<ReturnType<typeof quoteCheckout>>['cod']>;
const KNOWN_METHODS = ['COD', 'PREPAID', 'PARTIAL COD'];

// Only what the customer needs to see, without the internal order details.
const forCustomer = (quote: Quote) => ({
  subtotal: quote.subtotal,
  discount: quote.discount,
  prepaidDiscount: quote.prepaidDiscount,
  shippingFee: quote.shippingFee,
  codFee: quote.codFee,
  tax: quote.tax,
  total: quote.total,
  amountDueNow: quote.amountDueNow,
  amountDueLater: Math.round((quote.total - quote.amountDueNow) * 100) / 100,
});

export async function POST(request: Request) {
  try {
    const startedAt = Date.now();
    const { shop, sessionToken, items, couponCode, upsellVariantId, methods, customerName, customerEmail, address, city, state, pincode } = await request.json();

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

    if (!planAllowsPopupOrders(merchant.checkoutPlan)) {
      return NextResponse.json({ error: 'This store completes orders on Shopify checkout.' }, { status: 403 });
    }

    reconcileInBackground(merchant);

    const { cod, prepaid, partial } = await quoteCheckout(
      { ...merchant, accessToken: revealSecret(merchant.accessToken) ?? '' },
      {
        items,
        couponCode,
        upsellVariantId,
        customer: { phone, name: customerName, email: customerEmail, address, city, state, pincode },
      },
      Array.isArray(methods) && methods.length > 0 && methods.every((method) => KNOWN_METHODS.includes(method)) ? methods : undefined
    );

    console.log(`Quote timing: total=${Date.now() - startedAt}ms methods=${Array.isArray(methods) ? methods.join('+') : 'all'}`);

    return NextResponse.json({
      success: true,
      cod: cod && { ...forCustomer(cod), quoteToken: createQuoteToken(cod, shop, phone) },
      prepaid: prepaid && { ...forCustomer(prepaid), quoteToken: createQuoteToken(prepaid, shop, phone) },
      partial: partial && planAllowsPartialCod(merchant.checkoutPlan)
        ? { ...forCustomer(partial), quoteToken: createQuoteToken(partial, shop, phone) }
        : null,
    });
  } catch (error) {
    if (error instanceof CheckoutError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error('Checkout Quote Error:', error);
    return NextResponse.json({ error: 'Could not calculate your total. Please try again.' }, { status: 500 });
  }
}
