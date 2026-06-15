import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

async function checkApplicability(merchant: any, localCoupon: any, variantId: string) {
  if (localCoupon.appliesToType === 'all') return true;
  if (!variantId || !localCoupon.applicableItemIds) return false;

  const validIds = JSON.parse(localCoupon.applicableItemIds);
  if (validIds.length === 0) return true;

  try {
    // 1. Get Product ID from Variant ID
    const variantRes = await fetch(`https://\${merchant.shopDomain}/admin/api/2024-01/variants/\${variantId}.json`, {
      headers: { 'X-Shopify-Access-Token': merchant.accessToken }
    });
    if (!variantRes.ok) return false;
    const variantData = await variantRes.json();
    const productId = variantData.variant.product_id.toString();

    // 2. Check Product Match
    if (localCoupon.appliesToType === 'products') {
      return validIds.includes(productId);
    }

    // 3. Check Collection Match
    if (localCoupon.appliesToType === 'collections') {
      // Check custom collections
      const customRes = await fetch(`https://\${merchant.shopDomain}/admin/api/2024-01/custom_collections.json?product_id=\${productId}`, {
        headers: { 'X-Shopify-Access-Token': merchant.accessToken }
      });
      const smartRes = await fetch(`https://\${merchant.shopDomain}/admin/api/2024-01/smart_collections.json?product_id=\${productId}`, {
        headers: { 'X-Shopify-Access-Token': merchant.accessToken }
      });
      
      const customData = customRes.ok ? await customRes.json() : { custom_collections: [] };
      const smartData = smartRes.ok ? await smartRes.json() : { smart_collections: [] };
      
      const productCollectionIds = [
        ...customData.custom_collections.map((c: any) => c.id.toString()),
        ...smartData.smart_collections.map((c: any) => c.id.toString())
      ];

      return validIds.some((id: string) => productCollectionIds.includes(id));
    }
    
    return false;
  } catch (error) {
    console.error("Applicability Check Error:", error);
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { shop, cartTotal, variantId, appliedDiscounts } = data;
    const code = data.code ? data.code.toUpperCase() : null;

    if (!shop || !code) {
      return NextResponse.json({ error: 'Missing shop or discount code' }, { status: 400 });
    }

    const merchant = await prisma.merchant.findUnique({ where: { shopDomain: shop } });
    if (!merchant || !merchant.isActive || !merchant.accessToken) {
      return NextResponse.json({ error: 'Merchant not found or unauthorized' }, { status: 403 });
    }

    // 1. Check CheckoutFlow DB
    const localCoupon = await prisma.coupon.findFirst({
      where: {
        merchantId: merchant.id,
        code: { equals: code, mode: 'insensitive' },
        isActive: true
      }
    });

    if (localCoupon) {
      // Check Order Minimum/Maximum
      const total = cartTotal ? parseFloat(cartTotal) : 0;
      if (localCoupon.minimumOrderValue > 0 && total < localCoupon.minimumOrderValue) {
        return NextResponse.json({ success: false, valid: false, error: `Minimum order value is ₹\${localCoupon.minimumOrderValue}` }, { status: 200 });
      }
      if (localCoupon.maximumOrderValue && total > localCoupon.maximumOrderValue) {
        return NextResponse.json({ success: false, valid: false, error: `Maximum order value is ₹\${localCoupon.maximumOrderValue}` }, { status: 200 });
      }

      // Check Combinability
      if (appliedDiscounts && appliedDiscounts.length > 0) {
        if (!localCoupon.isCombinable) {
          return NextResponse.json({ success: false, valid: false, error: 'This code cannot be combined with other offers.' }, { status: 200 });
        }
        // Ensure all already applied discounts are also combinable (we trust the client array for now, but in a real app we'd verify each)
      }

      // Check Products / Collections
      const isApplicable = await checkApplicability(merchant, localCoupon, variantId);
      if (!isApplicable) {
         return NextResponse.json({ success: false, valid: false, error: 'This code is not valid for the items in your cart.' }, { status: 200 });
      }

      return NextResponse.json({
        success: true,
        valid: true,
        discount: {
          code: localCoupon.code,
          type: localCoupon.discountType,
          value: localCoupon.discountValue,
          freebieName: localCoupon.freebieName,
          isCombinable: localCoupon.isCombinable
        },
        source: 'checkoutflow'
      });
    }

    // 2. Check Shopify Native Discounts if not found locally
    const lookupRes = await fetch(`https://\${shop}/admin/api/2024-01/discount_codes/lookup.json?code=\${encodeURIComponent(code)}`, {
      method: 'GET',
      redirect: 'manual',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': merchant.accessToken }
    });

    let targetUrl = '';
    if (lookupRes.status === 303 || lookupRes.status === 301 || lookupRes.status === 302) {
      targetUrl = lookupRes.headers.get('location') || lookupRes.headers.get('Location') || '';
    } else if (lookupRes.ok) {
       const lookupData = await lookupRes.json();
       if (lookupData.discount_code && lookupData.discount_code.price_rule_id) {
           targetUrl = `https://\${shop}/admin/api/2024-01/price_rules/\${lookupData.discount_code.price_rule_id}.json`;
       }
    }

    if (!targetUrl) {
      return NextResponse.json({ success: false, valid: false, error: 'Invalid discount code' }, { status: 200 });
    }

    const match = targetUrl.match(/price_rules\\/(\\d+)/);
    if (!match) return NextResponse.json({ success: false, valid: false, error: 'Invalid discount code structure' }, { status: 200 });
    
    const priceRuleId = match[1];
    const ruleRes = await fetch(`https://\${shop}/admin/api/2024-01/price_rules/\${priceRuleId}.json`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': merchant.accessToken }
    });

    if (!ruleRes.ok) return NextResponse.json({ error: 'Failed to fetch price rule' }, { status: 500 });
    const ruleData = await ruleRes.json();
    const rule = ruleData.price_rule;

    return NextResponse.json({
      success: true,
      valid: true,
      discount: {
        code: code,
        type: rule.value_type,
        value: Math.abs(parseFloat(rule.value)),
        isCombinable: false // Shopify native discounts generally do not stack with custom unless specified
      },
      source: 'shopify'
    });

  } catch (error) {
    console.error('Validate Discount Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
