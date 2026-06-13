import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const shop = searchParams.get('shop');
    const phone = searchParams.get('phone');

    if (!shop || !phone) {
      return NextResponse.json({ error: 'Shop and phone are required' }, { status: 400 });
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
        phone: phone
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
