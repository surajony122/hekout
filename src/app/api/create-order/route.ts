import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { shop, productTitle, variantId, quantity, price, customerName, customerPhone, customerEmail, address, city, state, pincode, paymentMethod, appliedDiscount, prepaidDiscount, paymentId } = data;

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

    let totalDiscount = 0;
    let couponDiscountAmount = 0;
    let couponCodeStr = null;
    if (appliedDiscount) {
      if (appliedDiscount.type === 'percentage') {
        couponDiscountAmount = total * (appliedDiscount.value / 100);
      } else {
        couponDiscountAmount = appliedDiscount.value;
      }
      couponCodeStr = appliedDiscount.code;
      totalDiscount += couponDiscountAmount;
    }
    
    // Add prepaid discount if applicable
    let prepaidDiscountAmount = 0;
    if (prepaidDiscount) {
      prepaidDiscountAmount = parseFloat(prepaidDiscount) || 0;
      totalDiscount += prepaidDiscountAmount;
    }
    
    const finalTotal = Math.max(0, total - totalDiscount);

    // 3. Create Local Order (Pending)
    const order = await prisma.order.create({
      data: {
        merchantId: merchant.id,
        customerName, customerPhone, customerEmail,
        address, city, state, pincode,
        productTitle, variantId, quantity: parseInt(quantity) || 1, price: parseFloat(price) || 0, total: finalTotal,
        paymentMethod: paymentMethod || 'COD',
        paymentId: paymentId || null,
        prepaidDiscount: prepaidDiscountAmount,
        couponDiscount: couponDiscountAmount,
        couponCode: couponCodeStr,
        orderStatus: 'Pending'
      }
    });

    // 4. Create Shopify Draft Order via Admin API
    const lineItems: any[] = [{
      title: productTitle || 'Custom Product',
      price: price,
      quantity: parseInt(quantity) || 1,
      variant_id: variantId ? parseInt(variantId) : undefined
    }];

    if (appliedDiscount && appliedDiscount.type === 'freebie_product' && appliedDiscount.freebieName) {
      lineItems.push({
        title: appliedDiscount.freebieName,
        price: '0.00',
        quantity: 1,
        applied_discount: {
          description: appliedDiscount.code,
          value: '100.0',
          value_type: 'percentage',
          amount: '0.00'
        }
      });
    }

    const draftPayload = {
      draft_order: {
        line_items: lineItems,
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
        use_customer_default_address: false,
        shipping_line: {
          title: "Standard Shipping",
          price: "0.00"
        },
        applied_discount: (appliedDiscount && appliedDiscount.type !== 'freebie_product') ? {
          description: appliedDiscount.code,
          value_type: appliedDiscount.type,
          value: appliedDiscount.value.toString()
        } : (prepaidDiscount ? {
          description: 'Prepaid Discount',
          value_type: 'fixed_amount',
          value: prepaidDiscount.toString()
        } : undefined),
        tags: `${paymentMethod || 'COD'}, CheckoutFlow`,
        note: `Discounts applied. ${appliedDiscount ? 'Coupon: ' + appliedDiscount.code : ''}`
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
    // If it's a COD or Partial COD order, we pass ?payment_pending=true so it doesn't get marked as fully Paid
    const methodUpper = (paymentMethod || 'COD').toUpperCase();
    const isPending = methodUpper === 'COD' || methodUpper === 'PARTIAL COD';
    const completeUrl = `https://${shop}/admin/api/2024-01/draft_orders/${shopifyDraftOrderId}/complete.json${isPending ? '?payment_pending=true' : ''}`;
    
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

    // 6. Fetch the actual order to get the Order Status URL (Thank you page)
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

    // 7. Update Local Order Status to Synced
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
    console.error('Create Order Error:', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}
