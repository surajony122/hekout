'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function WidgetSettingsClient({ merchantId, initialSettings }: { merchantId: string, initialSettings: any }) {
  const [settings, setSettings] = useState({
    primaryColor: initialSettings.primaryColor || '#111827',
    preLoginBannerText: initialSettings.preLoginBannerText || '🎉 FREE SHIPPING ON ALL ORDERS TODAY!',
    preLoginBannerBg: initialSettings.preLoginBannerBg || '#000000',
    preLoginBannerColor: initialSettings.preLoginBannerColor || '#ffffff',
    postLoginBannerText: initialSettings.postLoginBannerText || '⚡ EXTRA 2% OFF ON UPI/CARDS',
    postLoginBannerBg: initialSettings.postLoginBannerBg || '#ecfdf5',
    postLoginBannerColor: initialSettings.postLoginBannerColor || '#059669',
    brandLogoUrl: initialSettings.brandLogoUrl || '',
    fbPixelId: initialSettings.fbPixelId || '',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSave = async () => {
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch('/api/settings/widget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchantId, ...settings })
      });
      const data = await res.json();
      if (data.success) {
        setMessage('Settings saved successfully!');
      } else {
        setMessage('Failed to save settings.');
      }
    } catch (err) {
      setMessage('Error saving settings.');
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle>Widget Appearance</CardTitle>
          <CardDescription>Customize the look and feel of your checkout widget.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none">Primary Brand Color (Hex)</label>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-md border" style={{ backgroundColor: settings.primaryColor }}></div>
              <Input 
                value={settings.primaryColor} 
                onChange={e => setSettings({...settings, primaryColor: e.target.value})} 
                placeholder="#111827"
                className="w-32"
              />
            </div>
            <p className="text-xs text-slate-500">Used for primary buttons, active states, and highlights.</p>
          </div>

          <div className="space-y-2 pt-4 border-t border-slate-100">
            <label className="text-sm font-medium leading-none">Brand Logo URL</label>
            <Input 
              value={settings.brandLogoUrl} 
              onChange={e => setSettings({...settings, brandLogoUrl: e.target.value})} 
              placeholder="https://yourstore.com/logo.png"
            />
            <p className="text-xs text-slate-500">Optional. Provide an image URL to replace the text store name in the checkout header.</p>
            {settings.brandLogoUrl && (
              <div className="mt-2 p-2 border rounded-md bg-slate-50 max-w-xs">
                <img src={settings.brandLogoUrl} alt="Brand Logo Preview" className="max-h-12 object-contain" />
              </div>
            )}
          </div>
          
          <div className="space-y-2 pt-4 border-t border-slate-100">
            <label className="text-sm font-medium leading-none">Facebook (Meta) Pixel ID</label>
            <Input 
              value={settings.fbPixelId} 
              onChange={e => setSettings({...settings, fbPixelId: e.target.value})} 
              placeholder="e.g. 1234567890"
              className="max-w-xs"
            />
            <p className="text-xs text-slate-500">Enter your Pixel ID to automatically track events like InitiateCheckout and Purchase.</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle>Pre-Login Banner</CardTitle>
            <CardDescription>Shown when user is asked for their phone number.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">Banner Text</label>
              <Input 
                value={settings.preLoginBannerText} 
                onChange={e => setSettings({...settings, preLoginBannerText: e.target.value})} 
              />
            </div>
            <div className="flex gap-4">
              <div className="space-y-2 flex-1">
                <label className="text-sm font-medium leading-none">Background Color</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={settings.preLoginBannerBg} onChange={e => setSettings({...settings, preLoginBannerBg: e.target.value})} />
                  <Input value={settings.preLoginBannerBg} onChange={e => setSettings({...settings, preLoginBannerBg: e.target.value})} className="w-24" />
                </div>
              </div>
              <div className="space-y-2 flex-1">
                <label className="text-sm font-medium leading-none">Text Color</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={settings.preLoginBannerColor} onChange={e => setSettings({...settings, preLoginBannerColor: e.target.value})} />
                  <Input value={settings.preLoginBannerColor} onChange={e => setSettings({...settings, preLoginBannerColor: e.target.value})} className="w-24" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle>Post-Login Banner</CardTitle>
            <CardDescription>Shown after OTP when payment options are visible.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">Banner Text</label>
              <Input 
                value={settings.postLoginBannerText} 
                onChange={e => setSettings({...settings, postLoginBannerText: e.target.value})} 
              />
            </div>
            <div className="flex gap-4">
              <div className="space-y-2 flex-1">
                <label className="text-sm font-medium leading-none">Background Color</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={settings.postLoginBannerBg} onChange={e => setSettings({...settings, postLoginBannerBg: e.target.value})} />
                  <Input value={settings.postLoginBannerBg} onChange={e => setSettings({...settings, postLoginBannerBg: e.target.value})} className="w-24" />
                </div>
              </div>
              <div className="space-y-2 flex-1">
                <label className="text-sm font-medium leading-none">Text Color</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={settings.postLoginBannerColor} onChange={e => setSettings({...settings, postLoginBannerColor: e.target.value})} />
                  <Input value={settings.postLoginBannerColor} onChange={e => setSettings({...settings, postLoginBannerColor: e.target.value})} className="w-24" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4">
        <Button onClick={handleSave} disabled={loading} className="bg-slate-900 text-white">
          {loading ? 'Saving...' : 'Save Settings'}
        </Button>
        {message && <span className="text-sm font-medium text-green-600">{message}</span>}
      </div>
    </div>
  );
}
