import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { shop, productTitle, variantId, quantity, price, customerName, customerPhone, customerEmail, address, city, state, pincode, paymentMethod } = data;

    // 1. Validate Merchant
    const merchant = await prisma.merchant.findUnique({
      where: { shopDomain: shop }
    });

    if (!merchant || !merchant.isActive) {
      return NextResponse.json({ error: 'Merchant not found or inactive' }, { status: 403 });
    }

    const total = (parseFloat(price) || 0) * (parseInt(quantity) || 1);

    // 2. Create/Update Customer Profile
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
          verificationStatus: 'Pending',
          lastOrderAt: new Date()
        }
      });
    }

    // 3. Create Local Order
    const order = await prisma.order.create({
      data: {
        merchantId: merchant.id,
        customerName, customerPhone, customerEmail,
        address, city, state, pincode,
        productTitle, variantId, quantity: parseInt(quantity) || 1, price: parseFloat(price) || 0, total,
        paymentMethod: paymentMethod || 'COD',
        orderStatus: 'Pending'
      }
    });

    // 4. Create Shopify Draft Order (Mocked for MVP)
    // In production: fetch(`https://${shop}/admin/api/2024-01/draft_orders.json`, { headers: { 'X-Shopify-Access-Token': merchant.accessToken }})
    const draftOrderId = 'mock_do_' + Math.floor(Math.random() * 100000);
    const shopifyOrderId = 'mock_o_' + Math.floor(Math.random() * 100000);

    // 5. Update Order Status
    await prisma.order.update({
      where: { id: order.id },
      data: {
        shopifyDraftOrderId: draftOrderId,
        shopifyOrderId: shopifyOrderId,
        orderStatus: 'Synced'
      }
    });

    return NextResponse.json({ success: true, orderId: order.id, shopifyOrderId });
  } catch (error) {
    console.error('Create Order Error:', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}
