'use client';

import { useState } from 'react';
import { Save, CheckCircle2, CreditCard, Percent } from 'lucide-react';

export default function PaymentSettingsClient({ merchantId, initialSettings }: { merchantId: string, initialSettings: any }) {
  const [formData, setFormData] = useState({
    razorpayKeyId: initialSettings.razorpayKeyId || '',
    razorpayKeySecret: initialSettings.razorpayKeySecret || '',
    cashfreeAppId: initialSettings.cashfreeAppId || '',
    cashfreeSecretKey: initialSettings.cashfreeSecretKey || '',
    isPrepaidDiscountEnabled: initialSettings.isPrepaidDiscountEnabled || false,
    prepaidDiscountType: initialSettings.prepaidDiscountType || 'percentage',
    prepaidDiscountValue: initialSettings.prepaidDiscountValue || 0,
    isPartialCodEnabled: initialSettings.isPartialCodEnabled || false,
    partialCodAmount: initialSettings.partialCodAmount || 0,
    codFeeAmount: initialSettings.codFeeAmount !== undefined ? initialSettings.codFeeAmount : 69,
  });

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    let finalValue: any = value;
    
    if (type === 'checkbox') {
      finalValue = (e.target as HTMLInputElement).checked;
    } else if (type === 'number') {
      finalValue = parseFloat(value) || 0;
    }

    setFormData(prev => ({ ...prev, [name]: finalValue }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSuccess(false);
    try {
      const res = await fetch('/api/settings/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchantId, ...formData })
      });
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      
      {/* Gateways Section */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <CreditCard size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Payment Gateways</h2>
            <p className="text-slate-500 text-sm">Connect your preferred payment providers.</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Razorpay */}
          <div className="border border-slate-100 rounded-xl p-5 bg-slate-50/50">
            <h3 className="font-semibold text-slate-800 mb-4">Razorpay Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Key ID</label>
                <input type="text" name="razorpayKeyId" value={formData.razorpayKeyId} onChange={handleChange} className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" placeholder="rzp_test_..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Key Secret</label>
                <input type="password" name="razorpayKeySecret" value={formData.razorpayKeySecret} onChange={handleChange} className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" placeholder="••••••••••••" />
              </div>
            </div>
          </div>

          {/* Cashfree */}
          <div className="border border-slate-100 rounded-xl p-5 bg-slate-50/50 opacity-70">
            <h3 className="font-semibold text-slate-800 mb-4">Cashfree Configuration <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded ml-2">Coming Soon</span></h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">App ID</label>
                <input type="text" name="cashfreeAppId" value={formData.cashfreeAppId} onChange={handleChange} disabled className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Secret Key</label>
                <input type="password" name="cashfreeSecretKey" value={formData.cashfreeSecretKey} onChange={handleChange} disabled className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-100" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Incentives Section */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <Percent size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Prepaid Incentives & COD</h2>
            <p className="text-slate-500 text-sm">Configure discounts to encourage online payments.</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Prepaid Discount */}
          <div className="border border-slate-100 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-slate-800">Prepaid Discounts</h3>
                <p className="text-slate-500 text-xs">Automatically deduct from total when user selects Pay Online.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" name="isPrepaidDiscountEnabled" checked={formData.isPrepaidDiscountEnabled} onChange={handleChange} className="sr-only peer" />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>
            
            {formData.isPrepaidDiscountEnabled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-100">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Discount Type</label>
                  <select name="prepaidDiscountType" value={formData.prepaidDiscountType} onChange={handleChange} className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500">
                    <option value="percentage">Percentage (%)</option>
                    <option value="flat">Flat Amount (₹)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Discount Value</label>
                  <input type="number" name="prepaidDiscountValue" value={formData.prepaidDiscountValue} onChange={handleChange} className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500" />
                </div>
              </div>
            )}
          </div>

          {/* Partial COD */}
          <div className="border border-slate-100 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-slate-800">Partial COD</h3>
                <p className="text-slate-500 text-xs">Collect a small amount upfront for COD orders to reduce RTO.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" name="isPartialCodEnabled" checked={formData.isPartialCodEnabled} onChange={handleChange} className="sr-only peer" />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            {formData.isPartialCodEnabled && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <label className="block text-sm font-medium text-slate-700 mb-1">Upfront Amount (₹)</label>
                <input type="number" name="partialCodAmount" value={formData.partialCodAmount} onChange={handleChange} className="w-full md:w-1/2 px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500" />
              </div>
            )}
          </div>

          {/* Standard COD Fee */}
          <div className="border border-slate-100 rounded-xl p-5">
            <h3 className="font-semibold text-slate-800 mb-2">Standard COD Fee</h3>
            <p className="text-slate-500 text-xs mb-4">The fee charged when a user selects Cash on Delivery.</p>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">COD Fee Amount (₹)</label>
              <input type="number" name="codFeeAmount" value={formData.codFeeAmount} onChange={handleChange} className="w-full md:w-1/2 px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button 
          onClick={handleSave} 
          disabled={saving || !merchantId}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-md font-medium text-white transition-all ${success ? 'bg-emerald-500' : 'bg-slate-900 hover:bg-slate-800'} shadow-sm`}
        >
          {success ? <CheckCircle2 size={18} /> : <Save size={18} />}
          <span>{saving ? 'Saving...' : success ? 'Saved!' : 'Save Settings'}</span>
        </button>
      </div>
    </div>
  );
}
