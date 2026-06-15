"use client";

import { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function DiscountEditForm({ coupon }: { coupon: any }) {
  const router = useRouter();
  const [code, setCode] = useState(coupon.code);
  const [discountValue, setDiscountValue] = useState(coupon.discountValue);
  const [minOrder, setMinOrder] = useState(coupon.minimumOrderValue || 0);
  const [maxOrder, setMaxOrder] = useState(coupon.maximumOrderValue || '');
  const [isAutoApply, setIsAutoApply] = useState(coupon.isAutoApply);
  const [isActive, setIsActive] = useState(coupon.isActive);
  const [isCombinable, setIsCombinable] = useState(coupon.isCombinable || false);
  const [appliesToType, setAppliesToType] = useState(coupon.appliesToType || 'all');
  const [applicableItemIds, setApplicableItemIds] = useState(coupon.applicableItemIds ? JSON.parse(coupon.applicableItemIds)[0] : '');
  
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);

  useEffect(() => {
    if (appliesToType === 'products' && products.length === 0) {
      fetch('/api/shopify/products').then(res => res.json()).then(data => {
        if (data.success) setProducts(data.products);
      });
    }
  }, [appliesToType]);

  useEffect(() => {
    if (appliesToType === 'collections' && collections.length === 0) {
      fetch('/api/shopify/collections').then(res => res.json()).then(data => {
        if (data.success) setCollections(data.collections);
      });
    }
  }, [appliesToType]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/discounts/\${coupon.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          code, 
          discountValue: Number(discountValue), 
          minimumOrderValue: Number(minOrder),
          maximumOrderValue: maxOrder ? Number(maxOrder) : null,
          isAutoApply, 
          isActive,
          isCombinable,
          appliesToType,
          applicableItemIds: applicableItemIds ? JSON.stringify([applicableItemIds]) : null
        })
      });
      const data = await res.json();
      if (data.success) {
        alert('Discount updated successfully!');
        router.refresh();
      } else {
        alert(data.error || 'Failed to update discount');
      }
    } catch (err) {
      alert('Error updating discount');
    }
    setLoading(false);
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] h-full">
      <h2 className="text-lg font-bold text-slate-900 mb-6">Edit Coupon Details</h2>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Coupon Code</label>
          <input 
            type="text" 
            value={code} 
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 font-bold uppercase" 
          />
        </div>
        
        {coupon.discountType !== 'freebie_product' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Value ({coupon.discountType === 'percentage' ? '%' : '₹'})</label>
            <input 
              type="number" 
              value={discountValue} 
              onChange={(e) => setDiscountValue(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500" 
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Min Order Value</label>
            <input 
              type="number" 
              value={minOrder} 
              onChange={(e) => setMinOrder(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Max Order Value</label>
            <input 
              type="number" 
              value={maxOrder} 
              onChange={(e) => setMaxOrder(e.target.value)}
              placeholder="No limit"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500" 
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Applies To</label>
          <select 
            value={appliesToType}
            onChange={(e) => {
              setAppliesToType(e.target.value);
              setApplicableItemIds('');
            }}
            className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Products</option>
            <option value="products">Specific Products</option>
            <option value="collections">Specific Collections</option>
          </select>
        </div>

        {appliesToType === 'products' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Select Product</label>
            <select 
              value={applicableItemIds}
              onChange={(e) => setApplicableItemIds(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 bg-white"
            >
              <option value="">-- Select a product --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id.split('/').pop()}>{p.title}</option>
              ))}
            </select>
          </div>
        )}

        {appliesToType === 'collections' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Select Collection</label>
            <select 
              value={applicableItemIds}
              onChange={(e) => setApplicableItemIds(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 bg-white"
            >
              <option value="">-- Select a collection --</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id.split('/').pop()}>{c.title}</option>
              ))}
            </select>
          </div>
        )}

        <div className="pt-4 space-y-2">
          <label className="flex items-center space-x-3 cursor-pointer">
            <input 
              type="checkbox" 
              checked={isActive} 
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" 
            />
            <span className="text-sm font-medium text-slate-700">Active</span>
          </label>
          <label className="flex items-center space-x-3 cursor-pointer">
            <input 
              type="checkbox" 
              checked={isAutoApply} 
              onChange={(e) => setIsAutoApply(e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" 
            />
            <span className="text-sm font-medium text-slate-700">Auto Apply</span>
          </label>
          <label className="flex items-center space-x-3 cursor-pointer">
            <input 
              type="checkbox" 
              checked={isCombinable} 
              onChange={(e) => setIsCombinable(e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" 
            />
            <span className="text-sm font-medium text-slate-700">Combinable with other codes</span>
          </label>
        </div>

        <button 
          onClick={handleSave} 
          disabled={loading}
          className="w-full mt-6 bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? 'Saving...' : <><Save size={16} /> Save Changes</>}
        </button>
      </div>
    </div>
  );
}
