import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { shop, productTitle, variantId, quantity, customerName, customerPhone, customerEmail, address, city, state, pincode, paymentMethod, paymentId, appliedCoupon } = data;

    // 1. Validate Merchant & Real Access Token
    const merchant = await prisma.merchant.findUnique({
      where: { shopDomain: shop }
    });

    if (!merchant || !merchant.isActive || !merchant.accessToken) {
      return NextResponse.json({ error: 'Merchant not found or missing access token' }, { status: 403 });
    }

    // 1b. Server-Side Price Fetching
    const variantRes = await fetch(`https://${shop}/admin/api/2024-01/variants/${variantId}.json`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': merchant.accessToken
      }
    });

    if (!variantRes.ok) {
      return NextResponse.json({ error: 'Invalid product variant' }, { status: 400 });
    }
    
    const variantData = await variantRes.json();
    const realPrice = parseFloat(variantData.variant.price) || 0;
    const total = realPrice * (parseInt(quantity) || 1);

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
    let prepaidDiscountAmount = 0;
    let couponDiscountAmount = 0;
    let discountTitles = [];

    // Fetch Payment Settings for Prepaid Discount
    const paymentSettings = await prisma.paymentSettings.findUnique({ where: { merchantId: merchant.id } });
    const methodUpper = (paymentMethod || 'COD').toUpperCase();
    const isCod = methodUpper === 'COD' || methodUpper === 'PARTIAL COD';

    // Calculate Prepaid Discount securely
    if (!isCod && paymentSettings?.isPrepaidDiscountEnabled) {
      if (paymentSettings.prepaidDiscountType === 'percentage') {
        prepaidDiscountAmount = total * (paymentSettings.prepaidDiscountValue / 100);
      } else {
        prepaidDiscountAmount = paymentSettings.prepaidDiscountValue;
      }
      totalDiscount += prepaidDiscountAmount;
      if (prepaidDiscountAmount > 0) discountTitles.push('Prepaid Discount');
    }

    // Calculate Coupon Discount securely
    if (appliedCoupon && appliedCoupon.code) {
      const dbCoupon = await prisma.discount.findFirst({
        where: { merchantId: merchant.id, code: appliedCoupon.code, isActive: true }
      });

      if (dbCoupon) {
        if (dbCoupon.type === 'percentage') {
          couponDiscountAmount = total * (dbCoupon.value / 100);
          if (dbCoupon.maxDiscount && couponDiscountAmount > dbCoupon.maxDiscount) {
            couponDiscountAmount = dbCoupon.maxDiscount;
          }
        } else {
          couponDiscountAmount = dbCoupon.value;
        }
        totalDiscount += couponDiscountAmount;
        if (couponDiscountAmount > 0) discountTitles.push(dbCoupon.code);
      }
    }
    
    const finalTotal = Math.max(0, total - totalDiscount);

    // 3. Create Local Order (Pending)
    const order = await prisma.order.create({
      data: {
        merchantId: merchant.id,
        customerName, customerPhone, customerEmail,
        address, city, state, pincode,
        productTitle, variantId, quantity: parseInt(quantity) || 1, price: realPrice, total: finalTotal,
        paymentMethod: paymentMethod || 'COD',
        paymentId: paymentId || null,
        prepaidDiscount: prepaidDiscountAmount,
        orderStatus: 'Pending'
      }
    });

    // 4. Create Shopify Draft Order via Admin API
    const lineItems: any[] = [{
      title: productTitle || 'Custom Product',
      price: realPrice.toString(),
      quantity: parseInt(quantity) || 1
    }];
    
    const parsedVariantId = parseInt(variantId);
    if (!isNaN(parsedVariantId)) {
       lineItems[0].variant_id = parsedVariantId;
    }

    // Calculate Shipping / COD Fee
    let shippingTitle = "Standard Shipping";
    let shippingPrice = "0.00";

    const isCodForShipping = methodUpper === 'COD' || methodUpper === 'PARTIAL COD';
    if (isCodForShipping) {
       if (paymentSettings?.codFeeAmount) {
          shippingTitle = "Cash on Delivery Fee";
          shippingPrice = paymentSettings.codFeeAmount.toString();
       }
    }

    const draftPayload = {
      draft_order: {
        line_items: lineItems,
        customer: {
          first_name: customerName || undefined,
          email: customerEmail || undefined,
          phone: customerPhone || undefined
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
        applied_discount: totalDiscount > 0 ? {
          description: discountTitles.join(' + '),
          value_type: 'fixed_amount',
          value: totalDiscount.toString()
        } : undefined,
        tags: `${paymentMethod || 'COD'}, CheckoutFlow`,
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
      return NextResponse.json({ error: 'Shopify Draft Order Error: ' + JSON.stringify(draftData.errors || draftData) }, { status: 500 });
    }

    const shopifyDraftOrderId = draftData.draft_order.id.toString();

    // 5. Complete Shopify Draft Order to convert it to a Real Order
    // If it's a COD or Partial COD order, we pass ?payment_pending=true so it doesn't get marked as fully Paid
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
