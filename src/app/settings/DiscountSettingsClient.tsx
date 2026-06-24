'use client';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";

export default function DiscountSettingsClient({ merchantId, initialDiscounts = [] }: { merchantId: string, initialDiscounts?: any[] }) {
  const [discounts, setDiscounts] = useState(initialDiscounts);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    code: '', title: '', description: '', type: 'percentage', value: '', minItems: '0', minCartValue: '0', isAuto: false, isActive: true
  });

  useEffect(() => {
    fetchDiscounts();
  }, []);

  const fetchDiscounts = async () => {
    try {
      const res = await fetch(`/api/settings/discounts?merchantId=${merchantId}`);
      const data = await res.json();
      if (data.success) setDiscounts(data.discounts);
    } catch (e) {}
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const payload = { ...formData, merchantId, id: editingId };
      const res = await fetch('/api/settings/discounts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setFormData({ code: '', title: '', description: '', type: 'percentage', value: '', minItems: '0', minCartValue: '0', isAuto: false, isActive: true });
        setEditingId(null);
        fetchDiscounts();
      }
    } catch (e) {}
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this discount?')) return;
    try {
      await fetch(`/api/settings/discounts?id=${id}`, { method: 'DELETE' });
      fetchDiscounts();
    } catch (e) {}
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle>{editingId ? 'Edit Discount' : 'Create New Discount'}</CardTitle>
          <CardDescription>Setup automatic or manual coupon codes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Coupon Code (e.g. SAVE20)</label>
              <input type="text" className="w-full mt-1 border rounded p-2 text-sm" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} />
            </div>
            <div>
              <label className="text-sm font-medium">Title (Optional)</label>
              <input type="text" className="w-full mt-1 border rounded p-2 text-sm" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
            </div>
            <div>
              <label className="text-sm font-medium">Type</label>
              <select className="w-full mt-1 border rounded p-2 text-sm" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                <option value="percentage">Percentage (%)</option>
                <option value="flat">Flat Amount (₹)</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Value</label>
              <input type="number" className="w-full mt-1 border rounded p-2 text-sm" value={formData.value} onChange={e => setFormData({...formData, value: e.target.value})} />
            </div>
            <div>
              <label className="text-sm font-medium">Min Items Required</label>
              <input type="number" className="w-full mt-1 border rounded p-2 text-sm" value={formData.minItems} onChange={e => setFormData({...formData, minItems: e.target.value})} />
            </div>
            <div>
              <label className="text-sm font-medium">Min Cart Value (₹)</label>
              <input type="number" className="w-full mt-1 border rounded p-2 text-sm" value={formData.minCartValue} onChange={e => setFormData({...formData, minCartValue: e.target.value})} />
            </div>
          </div>
          <div className="flex items-center space-x-4 mt-2">
            <label className="flex items-center space-x-2 text-sm">
              <input type="checkbox" checked={formData.isAuto} onChange={e => setFormData({...formData, isAuto: e.target.checked})} />
              <span>Auto-apply if conditions met</span>
            </label>
            <label className="flex items-center space-x-2 text-sm">
              <input type="checkbox" checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} />
              <span>Active</span>
            </label>
          </div>
        </CardContent>
        <CardFooter className="bg-slate-50 border-t flex justify-end">
          <button onClick={handleSave} disabled={loading} className="bg-slate-900 text-white px-4 py-2 rounded text-sm hover:bg-slate-800 transition">
            {loading ? 'Saving...' : 'Save Discount'}
          </button>
        </CardFooter>
      </Card>

      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle>Active Discounts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {discounts.map(d => (
              <div key={d.id} className="flex justify-between items-center p-4 border rounded">
                <div>
                  <div className="font-bold">{d.code} {d.isAuto && <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Auto</span>}</div>
                  <div className="text-sm text-gray-500">
                    {d.type === 'percentage' ? `${d.value}% OFF` : `₹${d.value} OFF`}
                    {d.minItems > 0 && ` • Min ${d.minItems} items`}
                  </div>
                </div>
                <div className="space-x-2">
                  <button onClick={() => {
                    setEditingId(d.id);
                    setFormData({ code: d.code, title: d.title || '', description: d.description || '', type: d.type, value: d.value.toString(), minItems: d.minItems.toString(), minCartValue: d.minCartValue.toString(), isAuto: d.isAuto, isActive: d.isActive });
                  }} className="text-sm text-blue-600">Edit</button>
                  <button onClick={() => handleDelete(d.id)} className="text-sm text-red-600">Delete</button>
                </div>
              </div>
            ))}
            {discounts.length === 0 && <p className="text-sm text-gray-500">No discounts configured yet.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
