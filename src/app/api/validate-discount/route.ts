import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { shop, code } = data;

    if (!shop || !code) {
      return NextResponse.json({ error: 'Missing shop or discount code' }, { status: 400 });
    }

    const merchant = await prisma.merchant.findUnique({
      where: { shopDomain: shop }
    });

    if (!merchant || !merchant.isActive || !merchant.accessToken) {
      return NextResponse.json({ error: 'Merchant not found or unauthorized' }, { status: 403 });
    }

    // 1. Check CheckoutFlow DB first
    const localCoupon = await prisma.coupon.findFirst({
      where: {
        merchantId: merchant.id,
        code: { equals: code, mode: 'insensitive' },
        isActive: true
      }
    });

    if (localCoupon) {
      return NextResponse.json({
        success: true,
        valid: true,
        discount: {
          code: localCoupon.code,
          type: localCoupon.discountType,
          value: localCoupon.discountValue,
          freebieName: localCoupon.freebieName
        },
        source: 'checkoutflow'
      });
    }

    // 2. Check Shopify Native Discounts if not found locally
    // Step A: Lookup the code to get the price_rule_id
    // Shopify returns a 303 Redirect to the specific discount code URL. Fetch drops headers on redirect, so we handle it manually.
    const lookupRes = await fetch(`https://${shop}/admin/api/2024-01/discount_codes/lookup.json?code=${encodeURIComponent(code)}`, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': merchant.accessToken
      }
    });

    let targetUrl = '';
    if (lookupRes.status === 303 || lookupRes.status === 301 || lookupRes.status === 302) {
      targetUrl = lookupRes.headers.get('location') || lookupRes.headers.get('Location') || '';
    } else if (lookupRes.ok) {
       const lookupData = await lookupRes.json();
       if (lookupData.discount_code && lookupData.discount_code.price_rule_id) {
           targetUrl = `https://${shop}/admin/api/2024-01/price_rules/${lookupData.discount_code.price_rule_id}.json`;
       }
    }

    if (!targetUrl) {
      // 404 means discount not found
      return NextResponse.json({ error: 'Invalid discount code' }, { status: 404 });
    }

    // Step B: Fetch the actual Price Rule to get the value
    // Target URL might be for discount_codes.json, we want the price_rule.
    // If it's a redirect to /admin/price_rules/123/discount_codes/456.json
    // We can extract price_rule_id and fetch the price rule.
    const match = targetUrl.match(/price_rules\/(\d+)/);
    if (!match) {
        return NextResponse.json({ error: 'Invalid discount code structure' }, { status: 404 });
    }
    const priceRuleId = match[1];

    const ruleRes = await fetch(`https://${shop}/admin/api/2024-01/price_rules/${priceRuleId}.json`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': merchant.accessToken
      }
    });

    if (!ruleRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch price rule details' }, { status: 500 });
    }

    const ruleData = await ruleRes.json();
    const rule = ruleData.price_rule;

    return NextResponse.json({
      success: true,
      valid: true,
      discount: {
        code: code,
        type: rule.value_type, // 'percentage' or 'fixed_amount'
        value: Math.abs(parseFloat(rule.value))
      },
      source: 'shopify'
    });

  } catch (error) {
    console.error('Validate Discount Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
