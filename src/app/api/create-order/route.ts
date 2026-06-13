import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { shop, productTitle, variantId, quantity, price, customerName, customerPhone, customerEmail, address, city, state, pincode, paymentMethod } = data;

    // 1. Validate Merchant & Real Access Token
    const merchant = await prisma.merchant.findUnique({
      where: { shopDomain: shop }
    });

    if (!merchant || !merchant.isActive || !merchant.accessToken) {
      return NextResponse.json({ error: 'Merchant not found or missing access token' }, { status: 403 });
    }

    const total = (parseFloat(price) || 0) * (parseInt(quantity) || 1);

    // 2. Create/Update Customer Profile Locally
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

    // 3. Create Local Order (Pending)
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

    // 4. Create Shopify Draft Order via Admin API
    const draftPayload = {
      draft_order: {
        line_items: [{
          title: productTitle || 'Custom Product',
          price: price,
          quantity: parseInt(quantity) || 1,
          variant_id: variantId ? parseInt(variantId) : undefined
        }],
        customer: {
          first_name: customerName,
          email: customerEmail,
          phone: customerPhone
        },
        shipping_address: {
          first_name: customerName,
          address1: address,
          city: city,
          province: state,
          zip: pincode,
          country: 'India'
        },
        use_customer_default_address: false
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
      return NextResponse.json({ error: 'Failed to create Shopify Draft Order' }, { status: 500 });
    }

    const shopifyDraftOrderId = draftData.draft_order.id.toString();

    // 5. Complete Shopify Draft Order to convert it to a Real Order
    const completeRes = await fetch(`https://${shop}/admin/api/2024-01/draft_orders/${shopifyDraftOrderId}/complete.json`, {
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

    // 6. Update Local Order Status to Synced
    await prisma.order.update({
      where: { id: order.id },
      data: {
        shopifyDraftOrderId,
        shopifyOrderId,
        orderStatus: 'Synced'
      }
    });

    return NextResponse.json({ success: true, orderId: order.id, shopifyOrderId });
  } catch (error) {
    console.error('Create Order Error:', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}
