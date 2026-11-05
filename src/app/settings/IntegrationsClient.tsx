'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function IntegrationsClient({ initialPixelId }: { initialPixelId: string }) {
  const [pixelId, setPixelId] = useState(initialPixelId);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings/widget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fbPixelId: pixelId.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(pixelId.trim() ? 'Meta Pixel connected.' : 'Meta Pixel removed.');
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : 'Could not save your Pixel ID.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader>
        <CardTitle>Meta Pixel</CardTitle>
        <CardDescription>Tracks InitiateCheckout when the popup opens and Purchase when an order is placed in it. Orders on Shopify checkout are tracked by your Shopify Meta connection instead.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <label htmlFor="pixel-id" className="text-sm font-medium leading-none">Pixel ID</label>
          <Input id="pixel-id" value={pixelId} inputMode="numeric" onChange={(e) => setPixelId(e.target.value)} placeholder="e.g. 1234567890" className="max-w-xs" />
        </div>
        <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
      </CardContent>
    </Card>
  );
}
