'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Initial = {
  fbPixelId: string;
  hasMetaCapiToken: boolean;
  ga4MeasurementId: string;
  googleAdsId: string;
  googleAdsLabel: string;
};

async function saveTracking(body: Record<string, unknown>) {
  const res = await fetch('/api/settings/widget', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data;
}

function Field({ id, label, hint, ...props }: { id: string; label: string; hint?: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium leading-none">{label}</label>
      <Input id={id} className="max-w-md" {...props} />
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export default function IntegrationsClient({ initial }: { initial: Initial }) {
  const [pixelId, setPixelId] = useState(initial.fbPixelId);
  const [token, setToken] = useState('');
  const [hasToken, setHasToken] = useState(initial.hasMetaCapiToken);
  const [ga4, setGa4] = useState(initial.ga4MeasurementId);
  const [adsId, setAdsId] = useState(initial.googleAdsId);
  const [adsLabel, setAdsLabel] = useState(initial.googleAdsLabel);
  const [saving, setSaving] = useState<'meta' | 'google' | null>(null);

  const run = async (which: 'meta' | 'google', body: Record<string, unknown>, success: string) => {
    setSaving(which);
    try {
      const data = await saveTracking(body);
      setHasToken(Boolean(data.settings?.hasMetaCapiToken));
      setToken('');
      toast.success(success);
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : 'Could not save these settings.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle>Meta Pixel and Conversions API</CardTitle>
          <CardDescription>
            The popup sends InitiateCheckout, AddPaymentInfo and Purchase to your Pixel. With a Conversions API token, each
            purchase is also sent from our server, so it still counts when an ad blocker stops the Pixel or the customer
            closes the page. Meta counts it once. Orders on Shopify checkout are tracked by your Shopify Meta connection instead.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field id="pixel-id" label="Pixel ID" value={pixelId} inputMode="numeric" onChange={(e) => setPixelId(e.target.value)} placeholder="e.g. 1234567890" />
          <Field
            id="capi-token"
            label="Conversions API access token"
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={hasToken ? 'Saved. Paste a new token to replace it.' : 'Paste the token from Events Manager'}
            hint="In Meta Events Manager, open your Pixel, go to Settings and choose Generate access token. It is stored encrypted and never shown again."
          />
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => run('meta', { fbPixelId: pixelId.trim(), ...(token.trim() ? { metaCapiToken: token.trim() } : {}) }, pixelId.trim() ? 'Meta tracking saved.' : 'Meta Pixel removed.')}
              disabled={saving !== null}
            >
              {saving === 'meta' ? 'Saving...' : 'Save'}
            </Button>
            {hasToken && (
              <Button variant="outline" onClick={() => run('meta', { removeMetaCapiToken: true }, 'Conversions API token removed.')} disabled={saving !== null}>
                Remove token
              </Button>
            )}
          </div>
          {hasToken && <p className="text-xs text-emerald-700">Conversions API is on.</p>}
        </CardContent>
      </Card>

      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle>Google Analytics and Google Ads</CardTitle>
          <CardDescription>
            The popup sends begin_checkout, add_payment_info and purchase to GA4, and a purchase conversion to Google Ads,
            with the order ID so a purchase isn&apos;t counted twice.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field id="ga4-id" label="GA4 Measurement ID" value={ga4} onChange={(e) => setGa4(e.target.value)} placeholder="G-XXXXXXXXXX" hint="In Google Analytics: Admin, Data streams, your web stream." />
          <Field id="ads-id" label="Google Ads conversion ID" value={adsId} onChange={(e) => setAdsId(e.target.value)} placeholder="AW-123456789" />
          <Field id="ads-label" label="Google Ads conversion label" value={adsLabel} onChange={(e) => setAdsLabel(e.target.value)} placeholder="AbC-D_efG-h12_34-567" hint="In Google Ads: Goals, Conversions, your purchase action, Tag setup, Use Google tag. The label is the part after the slash in send_to." />
          <Button
            onClick={() => run('google', { ga4MeasurementId: ga4, googleAdsId: adsId, googleAdsLabel: adsLabel }, 'Google tracking saved.')}
            disabled={saving !== null}
          >
            {saving === 'google' ? 'Saving...' : 'Save'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
