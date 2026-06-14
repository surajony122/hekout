import { prisma } from '@/lib/prisma';
import PaymentSettingsClient from './PaymentSettingsClient';
import WidgetSettingsClient from './WidgetSettingsClient';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  let merchant = null;
  let paymentSettings = null;
  let widgetSettings = null;

  try {
    merchant = await prisma.merchant.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' }
    });

    if (merchant) {
      paymentSettings = await prisma.paymentSettings.findUnique({
        where: { merchantId: merchant.id }
      });
      widgetSettings = await prisma.widgetSettings.findUnique({
        where: { merchantId: merchant.id }
      });
    }
  } catch (error) {
    console.error('Error fetching settings:', error);
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h1>
        <p className="text-slate-500 text-sm mt-1">Manage your store configuration and integrations.</p>
      </div>

      <Tabs defaultValue="payments" className="w-full">
        <TabsList className="bg-slate-100/50 p-1 mb-6 flex space-x-2 w-max">
          <TabsTrigger value="general" className="text-xs">General</TabsTrigger>
          <TabsTrigger value="widget" className="text-xs">Widget Design</TabsTrigger>
          <TabsTrigger value="otp" className="text-xs">OTP</TabsTrigger>
          <TabsTrigger value="payments" className="text-xs">Payments</TabsTrigger>
          <TabsTrigger value="shipping" className="text-xs">Shipping</TabsTrigger>
          <TabsTrigger value="notifications" className="text-xs">Notifications</TabsTrigger>
          <TabsTrigger value="integrations" className="text-xs">Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card className="shadow-sm border-slate-200">
            <CardHeader>
              <CardTitle>Store Details</CardTitle>
              <CardDescription>Update your store's branding and information.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-500">General settings coming soon.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="widget" className="space-y-4">
          <WidgetSettingsClient 
            merchantId={merchant?.id || ''} 
            initialSettings={widgetSettings || {}} 
          />
        </TabsContent>

        <TabsContent value="otp" className="space-y-4">
          <Card className="shadow-sm border-slate-200">
            <CardHeader>
              <CardTitle>OTP Verification</CardTitle>
              <CardDescription>Configure rules for phone number verification.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-500">OTP rules coming soon.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <PaymentSettingsClient 
            merchantId={merchant?.id || ''} 
            initialSettings={paymentSettings || {}} 
          />
        </TabsContent>

        <TabsContent value="shipping" className="space-y-4">
          <Card className="shadow-sm border-slate-200">
            <CardHeader>
              <CardTitle>Shipping & Serviceability</CardTitle>
              <CardDescription>Configure shipping rates and pincode serviceability.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-500">Shipping settings coming soon.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card className="shadow-sm border-slate-200">
            <CardHeader>
              <CardTitle>Customer Notifications</CardTitle>
              <CardDescription>Manage WhatsApp, SMS, and Email templates.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-500">Notification settings coming soon.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-4">
          <Card className="shadow-sm border-slate-200">
            <CardHeader>
              <CardTitle>App Integrations</CardTitle>
              <CardDescription>Connect with Shiprocket, Delhivery, Twilio, etc.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-500">Integrations coming soon.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
