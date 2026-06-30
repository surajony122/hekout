import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { shop, items, productTitle, variantId, quantity, customerName, customerPhone, customerEmail, address, city, state, pincode, paymentMethod, paymentId, appliedCoupon, upsellVariantId, notes, utmSource, utmMedium, utmCampaign, shippingFee, codFee } = data;
    const shippingFeePayload = shippingFee || 0;
    const codFeePayload = codFee || 0;

    // 1. Validate Merchant & Real Access Token
    const merchant = await prisma.merchant.findUnique({
      where: { shopDomain: shop }
    });

    if (!merchant || !merchant.isActive || !merchant.accessToken) {
      return NextResponse.json({ error: 'Merchant not found or missing access token' }, { status: 403 });
    }

    // 1b. Server-Side Price Fetching
    const cartItems = items || [{ variantId, quantity: parseInt(quantity) || 1, title: productTitle || 'Custom Product', price: 0 }];
    
    let total = 0;
    const lineItems: any[] = [];
    let finalProductTitle = '';

    for (const item of cartItems) {
        const variantRes = await fetch(`https://${shop}/admin/api/2024-01/variants/${item.variantId}.json`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': merchant.accessToken
          }
        });
        
        if (variantRes.ok) {
           const variantData = await variantRes.json();
           const realPrice = parseFloat(variantData.variant.price) || 0;
           const qty = parseInt(item.quantity) || 1;
           total += realPrice * qty;
           const title = item.title || variantData.variant.title || variantData.variant.name || 'Product';
           if (!finalProductTitle) {
               finalProductTitle = title;
           } else if (finalProductTitle.length < 50) {
               finalProductTitle += `, ${title}`;
           }
           
           const parsedVariantId = parseInt(item.variantId);
           lineItems.push({
               title: title,
               price: realPrice.toString(),
               quantity: qty,
               ...(isNaN(parsedVariantId) ? {} : { variant_id: parsedVariantId })
           });
        }
    }

    if (lineItems.length === 0) {
      return NextResponse.json({ error: 'Invalid product variants' }, { status: 400 });
    }
    
    // 1c. Upsell Processing
    let upsellRealPrice = 0;
    let upsellDiscountAmount = 0;
    let upsellLineItem = null;

    if (upsellVariantId) {
      const upsellRes = await fetch(`https://${shop}/admin/api/2024-01/variants/${upsellVariantId}.json`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': merchant.accessToken
        }
      });

      if (upsellRes.ok) {
        const upsellData = await upsellRes.json();
        upsellRealPrice = parseFloat(upsellData.variant.price) || 0;
        
        // Fetch active upsell from DB to get the discount
        const activeUpsell = await prisma.upsellFunnel.findFirst({
          where: { merchantId: merchant.id, offerVariantId: upsellVariantId.toString(), isActive: true }
        });

        if (activeUpsell) {
           if (activeUpsell.discountType === 'percentage') {
             upsellDiscountAmount = upsellRealPrice * (activeUpsell.discountValue / 100);
           } else {
             upsellDiscountAmount = activeUpsell.discountValue;
           }
           finalProductTitle += ` + ${activeUpsell.offerTitle}`;
           
           upsellLineItem = {
             title: activeUpsell.offerTitle,
             price: upsellRealPrice.toString(),
             quantity: 1,
             variant_id: parseInt(upsellVariantId)
           };
           
           total += upsellRealPrice;
           
           // Track impression/conversion asynchronously (fire & forget)
           prisma.upsellFunnel.update({
             where: { id: activeUpsell.id },
             data: { conversions: { increment: 1 }, revenue: { increment: (upsellRealPrice - upsellDiscountAmount) } }
           }).catch(() => {});
        }
      }
    }

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

    let totalDiscount = upsellDiscountAmount;
    let prepaidDiscountAmount = 0;
    let couponDiscountAmount = 0;
    const discountTitles = [];
    if (upsellDiscountAmount > 0) discountTitles.push('Upsell Offer');

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

    // Fetch Payment Settings for Prepaid Discount
    const paymentSettings = await prisma.paymentSettings.findUnique({ where: { merchantId: merchant.id } });
    const methodUpper = (paymentMethod || 'COD').toUpperCase();
    const isCod = methodUpper === 'COD' || methodUpper === 'PARTIAL COD';

    // Calculate Prepaid Discount securely (after coupon)
    if (!isCod && paymentSettings?.isPrepaidDiscountEnabled) {
      const amountAfterCoupon = Math.max(0, total - couponDiscountAmount);
      if (paymentSettings.prepaidDiscountType === 'percentage') {
        prepaidDiscountAmount = amountAfterCoupon * (paymentSettings.prepaidDiscountValue / 100);
      } else {
        prepaidDiscountAmount = paymentSettings.prepaidDiscountValue;
      }
      totalDiscount += prepaidDiscountAmount;
      if (prepaidDiscountAmount > 0) discountTitles.push('Prepaid Discount');
    }
    
    const finalTotal = Math.max(0, total - totalDiscount) + shippingFeePayload + codFeePayload;

    // 3. Create Local Order (Pending)
    const order = await prisma.order.create({
      data: {
        merchantId: merchant.id,
        customerName, customerPhone, customerEmail,
        address, city, state, pincode,
        productTitle: finalProductTitle, 
        variantId: cartItems[0]?.variantId || variantId || '', 
        quantity: cartItems.reduce((acc: number, i: any) => acc + (parseInt(i.quantity) || 1), 0), 
        price: parseFloat(cartItems[0]?.price) || 0, 
        total: finalTotal,
        paymentMethod: paymentMethod || 'COD',
        paymentId: paymentId || null,
        prepaidDiscount: prepaidDiscountAmount,
        orderStatus: 'Pending',
        utmSource: utmSource || null,
        utmMedium: utmMedium || null,
        utmCampaign: utmCampaign || null
      }
    });

    // 4. Create Shopify Draft Order via Admin API
    // lineItems already populated in Step 1b

    if (upsellLineItem) {
       lineItems.push(upsellLineItem);
    }

    let shippingTitle = "Shipping & Handling";
    let shippingPrice = "0.00";

    if (shippingFeePayload > 0) {
        shippingTitle = "Shipping Fee";
        shippingPrice = shippingFeePayload.toString();
    } else if (codFeePayload > 0) {
        shippingTitle = "Cash on Delivery Fee";
        shippingPrice = codFeePayload.toString();
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
