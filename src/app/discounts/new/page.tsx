"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewDiscountPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [type, setType] = useState('percentage');
  const [value, setValue] = useState('');
  const [freebieName, setFreebieName] = useState('');
  const [minOrder, setMinOrder] = useState('');
  const [maxOrder, setMaxOrder] = useState('');
  const [isAutoApply, setIsAutoApply] = useState(false);
  const [isCombinable, setIsCombinable] = useState(false);
  const [appliesToType, setAppliesToType] = useState('all');
  const [applicableItemIds, setApplicableItemIds] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [products, setProducts] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingCollections, setLoadingCollections] = useState(false);

  useEffect(() => {
    if (type === 'freebie_product' || appliesToType === 'products') {
      if (products.length === 0) {
        setLoadingProducts(true);
        fetch('/api/shopify/products')
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              setProducts(data.products);
              if (type === 'freebie_product' && !freebieName) {
                setFreebieName(data.products[0]?.title || '');
              }
            }
          })
          .finally(() => setLoadingProducts(false));
      }
    }
  }, [type, appliesToType]);

  useEffect(() => {
    if (appliesToType === 'collections' && collections.length === 0) {
      setLoadingCollections(true);
      fetch('/api/shopify/collections')
        .then(res => res.json())
        .then(data => {
          if (data.success) setCollections(data.collections);
        })
        .finally(() => setLoadingCollections(false));
    }
  }, [appliesToType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/discounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          discountType: type,
          discountValue: value,
          freebieName: type === 'freebie_product' ? freebieName : null,
          minimumOrderValue: minOrder,
          maximumOrderValue: maxOrder || null,
          isAutoApply,
          isCombinable,
          appliesToType,
          applicableItemIds: applicableItemIds ? JSON.stringify([applicableItemIds]) : null
        })
      });

      const data = await res.json();
      if (res.ok) {
        router.push('/discounts');
        router.refresh();
      } else {
        setError(data.error || 'Failed to create discount');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-10">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-slate-800">Create Custom Discount</h1>
        <Link href="/discounts" className="text-sm font-medium text-slate-500 hover:text-slate-800">
          Cancel
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Discount Code</label>
            <input 
              type="text" 
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. SUMMER10, FREEGIFT"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Discount Type</label>
              <select 
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed_amount">Fixed Amount (₹)</option>
                <option value="freebie_product">Freebie / Upsell Product</option>
              </select>
            </div>

            {type !== 'freebie_product' ? (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Discount Value</label>
                <div className="relative">
                  {type === 'fixed_amount' && (
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 font-medium">₹</div>
                  )}
                  <input 
                    type="number" 
                    required
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={type === 'percentage' ? "10" : "500"}
                    className={`w-full py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 \${type === 'fixed_amount' ? 'pl-8 pr-4' : 'px-4'}`}
                  />
                  {type === 'percentage' && (
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-500 font-medium">%</div>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Select Freebie Product</label>
                {loadingProducts ? (
                  <div className="text-sm text-slate-500 py-2">Loading products...</div>
                ) : (
                  <select 
                    required
                    value={freebieName}
                    onChange={(e) => setFreebieName(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="" disabled>Select a product</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.title}>{p.title}</option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 pt-6">
            <h3 className="text-sm font-semibold text-slate-800 mb-4 uppercase tracking-wider">Applicability</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Applies To</label>
                <select 
                  value={appliesToType}
                  onChange={(e) => {
                    setAppliesToType(e.target.value);
                    setApplicableItemIds('');
                  }}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">All Products</option>
                  <option value="products">Specific Products</option>
                  <option value="collections">Specific Collections</option>
                </select>
              </div>

              {appliesToType === 'products' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Select Product</label>
                  {loadingProducts ? (
                    <div className="text-sm text-slate-500">Loading products...</div>
                  ) : (
                    <select 
                      value={applicableItemIds}
                      onChange={(e) => setApplicableItemIds(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                    >
                      <option value="">-- Select a product --</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id.split('/').pop()}>{p.title}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {appliesToType === 'collections' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Select Collection</label>
                  {loadingCollections ? (
                    <div className="text-sm text-slate-500">Loading collections...</div>
                  ) : (
                    <select 
                      value={applicableItemIds}
                      onChange={(e) => setApplicableItemIds(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                    >
                      <option value="">-- Select a collection --</option>
                      {collections.map((c) => (
                        <option key={c.id} value={c.id.split('/').pop()}>{c.title}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-6">
            <h3 className="text-sm font-semibold text-slate-800 mb-4 uppercase tracking-wider">Requirements</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Minimum Order Value</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 font-medium">₹</div>
                  <input 
                    type="number" 
                    value={minOrder}
                    onChange={(e) => setMinOrder(e.target.value)}
                    placeholder="0"
                    className="w-full py-2 pl-8 pr-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Maximum Order Value</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 font-medium">₹</div>
                  <input 
                    type="number" 
                    value={maxOrder}
                    onChange={(e) => setMaxOrder(e.target.value)}
                    placeholder="No limit"
                    className="w-full py-2 pl-8 pr-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-6 space-y-4">
            <label className="flex items-start space-x-3 cursor-pointer">
              <input 
                type="checkbox" 
                checked={isAutoApply}
                onChange={(e) => setIsAutoApply(e.target.checked)}
                className="w-5 h-5 text-emerald-500 border-slate-300 rounded focus:ring-emerald-500 mt-0.5"
              />
              <div>
                <span className="text-sm font-medium text-slate-700 block">Auto-Apply to all checkouts</span>
                <span className="text-xs text-slate-500">If checked, customers won't need to enter the code manually.</span>
              </div>
            </label>

            <label className="flex items-start space-x-3 cursor-pointer">
              <input 
                type="checkbox" 
                checked={isCombinable}
                onChange={(e) => setIsCombinable(e.target.checked)}
                className="w-5 h-5 text-emerald-500 border-slate-300 rounded focus:ring-emerald-500 mt-0.5"
              />
              <div>
                <span className="text-sm font-medium text-slate-700 block">Combinable with other discounts</span>
                <span className="text-xs text-slate-500">Allow this discount to be stacked with other valid codes.</span>
              </div>
            </label>
          </div>

          <div className="pt-6">
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-emerald-500 text-white font-bold py-3 rounded-lg hover:bg-emerald-600 transition disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Discount'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
