"use client";

import { useState } from 'react';
import { Save } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function DiscountEditForm({ coupon }: { coupon: any }) {
  const router = useRouter();
  const [code, setCode] = useState(coupon.code);
  const [discountValue, setDiscountValue] = useState(coupon.discountValue);
  const [isAutoApply, setIsAutoApply] = useState(coupon.isAutoApply);
  const [isActive, setIsActive] = useState(coupon.isActive);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/discounts/${coupon.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, discountValue: Number(discountValue), isAutoApply, isActive })
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
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Discount Value ({coupon.discountType === 'percentage' ? '%' : '₹'})</label>
          <input 
            type="number" 
            value={discountValue} 
            onChange={(e) => setDiscountValue(e.target.value)}
            className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500" 
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <label className="text-sm font-medium text-slate-700">Auto Apply at Checkout</label>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={isAutoApply} onChange={(e) => setIsAutoApply(e.target.checked)} className="sr-only peer"/>
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
          </label>
        </div>

        <div className="flex items-center justify-between pt-2 pb-4">
          <label className="text-sm font-medium text-slate-700">Coupon Status (Active)</label>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="sr-only peer"/>
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
          </label>
        </div>

        <button 
          onClick={handleSave} 
          disabled={loading}
          className="w-full flex justify-center items-center gap-2 bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors shadow-md disabled:opacity-70"
        >
          <Save size={18} />
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
