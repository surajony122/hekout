import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CheckoutError, quoteCheckout } from '@/lib/checkout-pricing';
import { readCheckoutSession } from '@/lib/checkout-session';

type Quote = Awaited<ReturnType<typeof quoteCheckout>>['cod'];

// Only what the customer needs to see, without the internal order details.
const forCustomer = (quote: Quote) => ({
  subtotal: quote.subtotal,
  discount: quote.discount,
  prepaidDiscount: quote.prepaidDiscount,
  shippingFee: quote.shippingFee,
  codFee: quote.codFee,
  tax: quote.tax,
  total: quote.total,
});

export async function POST(request: Request) {
  try {
    const { shop, sessionToken, items, couponCode, upsellVariantId, customerName, customerEmail, address, city, state, pincode } = await request.json();

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

    const { cod, prepaid } = await quoteCheckout(
      { ...merchant, accessToken: merchant.accessToken },
      {
        items,
        couponCode,
        upsellVariantId,
        customer: { phone, name: customerName, email: customerEmail, address, city, state, pincode },
      }
    );

    return NextResponse.json({ success: true, cod: forCustomer(cod), prepaid: forCustomer(prepaid) });
  } catch (error) {
    if (error instanceof CheckoutError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error('Checkout Quote Error:', error);
    return NextResponse.json({ error: 'Could not calculate your total. Please try again.' }, { status: 500 });
  }
}
