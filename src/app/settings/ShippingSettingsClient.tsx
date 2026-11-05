'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ShippingSettingsClient({ initial }: {
  initial: { isShippingFeeEnabled: boolean; shippingFeeAmount: number; freeShippingThreshold: number };
}) {
  const [enabled, setEnabled] = useState(initial.isShippingFeeEnabled);
  const [fee, setFee] = useState(String(initial.shippingFeeAmount));
  const [threshold, setThreshold] = useState(String(initial.freeShippingThreshold));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings/shipping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isShippingFeeEnabled: enabled, shippingFeeAmount: fee, freeShippingThreshold: threshold }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Shipping settings saved.');
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : 'Could not save your shipping settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader>
        <CardTitle>Shipping</CardTitle>
        <CardDescription>Charge a shipping fee in the popup checkout, and set the cart value that makes shipping free. Shopify checkout uses your Shopify shipping rates.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex items-center gap-3 text-sm font-medium text-slate-900 cursor-pointer">
          <input type="checkbox" className="w-4 h-4 accent-slate-900" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Charge a shipping fee
        </label>
        {enabled && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="shipping-fee" className="text-sm font-medium leading-none">Shipping fee (₹)</label>
              <Input id="shipping-fee" type="number" min="0" value={fee} onChange={(e) => setFee(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label htmlFor="free-shipping" className="text-sm font-medium leading-none">Free shipping from (₹)</label>
              <Input id="free-shipping" type="number" min="0" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
            </div>
          </div>
        )}
        <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save shipping'}</Button>
      </CardContent>
    </Card>
  );
}
