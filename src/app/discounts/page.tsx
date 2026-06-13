import { prisma } from '@/lib/prisma';
import Link from 'next/link';

export default async function DiscountsPage() {
  let shopifyDiscounts: any[] = [];
  let localCoupons: any[] = [];
  let error = '';

  try {
    // For MVP, just grab the first active merchant
    const merchant = await prisma.merchant.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' }
    });

    if (merchant && merchant.accessToken) {
      // 1. Fetch Shopify Native Discounts (Price Rules)
      const res = await fetch(`https://${merchant.shopDomain}/admin/api/2024-01/price_rules.json`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': merchant.accessToken
        },
        cache: 'no-store'
      });

      if (res.ok) {
        const data = await res.json();
        shopifyDiscounts = data.price_rules || [];
      } else {
        error = 'Failed to fetch Shopify discounts. Have you granted the required permissions?';
      }

      // 2. Fetch CheckoutFlow Custom Coupons
      localCoupons = await prisma.coupon.findMany({
        where: { merchantId: merchant.id },
        orderBy: { createdAt: 'desc' }
      });
    } else {
      error = 'No active merchant connected. Please install the app first.';
    }
  } catch (err: any) {
    error = err.message || 'An error occurred';
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-slate-800">Discounts & Upsells</h1>
        <Link href="/discounts/new" className="bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-600">
          + Create Custom Discount
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200">
          {error}
        </div>
      )}

      {/* Shopify Discounts */}
      <div>
        <h2 className="text-xl font-semibold text-slate-800 mb-4">Native Shopify Discounts</h2>
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-sm font-medium text-slate-500">
                  <th className="p-4">Title (Campaign)</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Value</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {shopifyDiscounts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-500">
                      No active price rules found in Shopify.
                    </td>
                  </tr>
                ) : (
                  shopifyDiscounts.map((rule) => (
                    <tr key={rule.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="p-4 font-medium text-slate-800">{rule.title}</td>
                      <td className="p-4 text-slate-600 capitalize">{rule.value_type.replace('_', ' ')}</td>
                      <td className="p-4 font-medium text-emerald-600">
                        {rule.value_type === 'percentage' ? `${Math.abs(rule.value)}%` : `₹${Math.abs(rule.value)}`}
                      </td>
                      <td className="p-4">
                        <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-medium">
                          Active
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* CheckoutFlow Custom Coupons */}
      <div>
        <h2 className="text-xl font-semibold text-slate-800 mb-4">CheckoutFlow Custom Coupons</h2>
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-sm font-medium text-slate-500">
                  <th className="p-4">Code</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Value</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {localCoupons.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-500">
                      No custom coupons created yet.
                    </td>
                  </tr>
                ) : (
                  localCoupons.map((coupon) => (
                    <tr key={coupon.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="p-4 font-medium text-slate-800">{coupon.code}</td>
                      <td className="p-4 text-slate-600 capitalize">{coupon.discountType.replace('_', ' ')}</td>
                      <td className="p-4 font-medium text-emerald-600">
                        {coupon.discountType === 'percentage' ? `${coupon.discountValue}%` : coupon.discountType === 'freebie_product' ? `Free: ${coupon.freebieName}` : `₹${coupon.discountValue}`}
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${coupon.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                          {coupon.isActive ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
