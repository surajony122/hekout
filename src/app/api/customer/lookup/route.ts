import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { readCheckoutSession } from '@/lib/checkout-session';

export async function POST(request: Request) {
  try {
    const { shop, sessionToken } = await request.json();

    if (typeof shop !== 'string' || !shop) {
      return NextResponse.json({ error: 'Shop is required' }, { status: 400 });
    }

    // Customers can only look up the phone number they verified by OTP.
    const phone = readCheckoutSession(sessionToken, shop);
    if (!phone) {
      return NextResponse.json({ error: 'Please verify your phone number again.' }, { status: 401 });
    }

    const merchant = await prisma.merchant.findUnique({
      where: { shopDomain: shop }
    });

    if (!merchant || !merchant.isActive) {
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    const customer = await prisma.customerProfile.findFirst({
      where: {
        merchantId: merchant.id,
        phone
      },
      orderBy: {
        lastOrderAt: 'desc'
      }
    });

    if (!customer) {
      return NextResponse.json({ success: true, customer: null });
    }

    return NextResponse.json({
      success: true,
      customer: {
        name: customer.name || '',
        email: customer.email || '',
        address: customer.address || '',
        city: customer.city || '',
        state: customer.state || '',
        pincode: customer.pincode || ''
      }
    });
  } catch (error) {
    console.error('Customer Lookup Error:', error);
    return NextResponse.json({ error: 'Failed to look up customer' }, { status: 500 });
  }
}
