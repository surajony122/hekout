import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { Plus, Tag, Search, ChevronDown, Download } from 'lucide-react';
import DiscountActions from './DiscountActions';

export const dynamic = 'force-dynamic';

export default async function DiscountsPage() {
  let shopifyDiscounts: any[] = [];
  let localCoupons: any[] = [];
  let error = '';

  try {
    const merchant = await prisma.merchant.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' }
    });

    if (merchant && merchant.accessToken) {
      const res = await fetch(`https://${merchant.shopDomain}/admin/api/2024-01/price_rules.json`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': merchant.accessToken },
        cache: 'no-store'
      });

      if (res.ok) {
        const data = await res.json();
        shopifyDiscounts = data.price_rules || [];
      } else {
        error = 'Failed to fetch Shopify discounts.';
      }

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
    <div className="bg-[#f4f7fe] min-h-screen p-4 md:p-8 font-sans text-slate-800">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Discounts</h1>
          <p className="text-slate-500 text-sm mt-1">Manage native and custom auto-discounts</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/discounts/new" className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm">
            <Plus size={16} />
            <span>Create Custom Discount</span>
          </Link>
          <button className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm">
            <Download size={16} className="text-slate-500" />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 mb-6 text-sm font-medium shadow-sm">
          {error}
        </div>
      )}

      {/* CheckoutFlow Custom Coupons */}
      <div className="bg-white p-6 rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] overflow-x-auto mb-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Tag size={18} className="text-indigo-500"/> Custom Active Discounts</h2>
          </div>
          <div className="flex gap-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Search discounts..." className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm w-64 focus:outline-none focus:border-indigo-500" />
            </div>
            <button className="flex items-center gap-2 border border-slate-200 px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50">
              Type <ChevronDown size={16} />
            </button>
          </div>
        </div>

        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 rounded-lg">
              <th className="py-3 px-4 text-sm font-semibold text-slate-500 first:rounded-l-lg">Code</th>
              <th className="py-3 px-4 text-sm font-semibold text-slate-500">Type</th>
              <th className="py-3 px-4 text-sm font-semibold text-slate-500">Value / Freebie</th>
              <th className="py-3 px-4 text-sm font-semibold text-slate-500">Auto Apply</th>
              <th className="py-3 px-4 text-sm font-semibold text-slate-500 last:rounded-r-lg">Status & Action</th>
            </tr>
          </thead>
          <tbody>
            {localCoupons.length === 0 ? (
              <tr><td colSpan={5} className="py-8 text-center text-slate-500">No custom discounts created yet.</td></tr>
            ) : (
              localCoupons.map((coupon) => (
                <tr key={coupon.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                  <td className="py-4 px-4 font-bold text-slate-900">{coupon.code}</td>
                  <td className="py-4 px-4 text-sm text-slate-600 capitalize">{coupon.discountType.replace('_', ' ')}</td>
                  <td className="py-4 px-4 text-sm font-medium text-emerald-600">
                    {coupon.discountType === 'percentage' ? `${coupon.discountValue}%` : coupon.discountType === 'freebie_product' ? `Gift: ${coupon.freebieName}` : `₹${coupon.discountValue}`}
                  </td>
                  <td className="py-4 px-4">
                    {coupon.isAutoApply ? <span className="bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-md text-xs font-bold">Auto</span> : <span className="text-slate-400 text-xs">Manual</span>}
                  </td>
                  <td className="py-4 px-4">
                    <DiscountActions id={coupon.id} initialStatus={coupon.isActive} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Shopify Discounts */}
      <div className="bg-white p-6 rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] overflow-x-auto">
        <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">Native Shopify Discounts</h2>
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 rounded-lg">
              <th className="py-3 px-4 text-sm font-semibold text-slate-500 first:rounded-l-lg">Title (Campaign)</th>
              <th className="py-3 px-4 text-sm font-semibold text-slate-500">Type</th>
              <th className="py-3 px-4 text-sm font-semibold text-slate-500">Value</th>
              <th className="py-3 px-4 text-sm font-semibold text-slate-500 last:rounded-r-lg">Status</th>
            </tr>
          </thead>
          <tbody>
            {shopifyDiscounts.length === 0 ? (
              <tr><td colSpan={4} className="py-8 text-center text-slate-500">No active price rules found in Shopify.</td></tr>
            ) : (
              shopifyDiscounts.map((rule) => (
                <tr key={rule.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                  <td className="py-4 px-4 font-medium text-slate-900">{rule.title}</td>
                  <td className="py-4 px-4 text-sm text-slate-600 capitalize">{rule.value_type.replace('_', ' ')}</td>
                  <td className="py-4 px-4 text-sm font-medium text-emerald-600">
                    {rule.value_type === 'percentage' ? `${Math.abs(rule.value)}%` : `₹${Math.abs(rule.value)}`}
                  </td>
                  <td className="py-4 px-4">
                    <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md text-xs font-medium">Synced</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
