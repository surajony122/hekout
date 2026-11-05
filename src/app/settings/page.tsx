import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { getLoggedInMerchant } from '@/lib/merchant-auth';
import PaymentSettingsClient from './PaymentSettingsClient';
import WidgetSettingsClient from './WidgetSettingsClient';
import PlanSettingsClient from './PlanSettingsClient';
import { CHECKOUT_PLANS, planFeePercent } from '@/lib/plans';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const merchant = await getLoggedInMerchant();
  if (!merchant) redirect('/login');

  let paymentSettings = null;
  let widgetSettings = null;
  let feeTotals = { _count: 0, _sum: { total: 0 as number | null, feeAmount: 0 as number | null } };

  // Months follow Indian time, whatever timezone the server runs in.
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const nowInIndia = new Date(Date.now() + IST_OFFSET_MS);
  const monthStart = new Date(Date.UTC(nowInIndia.getUTCFullYear(), nowInIndia.getUTCMonth(), 1) - IST_OFFSET_MS);

  const planOptions = Object.entries(CHECKOUT_PLANS).map(([id, plan]) => ({
    id,
    name: plan.name,
    description: plan.description,
    available: plan.available,
    feePercent: planFeePercent(id),
  }));

  try {
    feeTotals = await prisma.order.aggregate({
      where: { merchantId: merchant.id, orderStatus: 'Synced', createdAt: { gte: monthStart } },
      _count: true,
      _sum: { total: true, feeAmount: true },
    });
    paymentSettings = await prisma.paymentSettings.findUnique({
      where: { merchantId: merchant.id }
    });
    widgetSettings = await prisma.widgetSettings.findUnique({
      where: { merchantId: merchant.id }
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
  }

  // Saved secrets stay on the server, and the page only learns whether one exists.
  const safePaymentSettings = paymentSettings
    ? (({ razorpayKeySecret, cashfreeSecretKey, payuMerchantKey, payuMerchantSalt, ...rest }) => ({
        ...rest,
        hasRazorpaySecret: Boolean(razorpayKeySecret),
      }))(paymentSettings)
    : {};

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
          <TabsTrigger value="plan" className="text-xs">Plan & Fees</TabsTrigger>
          <TabsTrigger value="discounts" className="text-xs">Discounts</TabsTrigger>
          <TabsTrigger value="shipping" className="text-xs">Shipping</TabsTrigger>
          <TabsTrigger value="notifications" className="text-xs">Notifications</TabsTrigger>
          <TabsTrigger value="integrations" className="text-xs">Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card className="shadow-sm border-slate-200">
            <CardHeader>
              <CardTitle>Store Details</CardTitle>
              <CardDescription>Update your store&apos;s branding and information.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-500">General settings coming soon.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="widget" className="space-y-4">
          <WidgetSettingsClient
            initialSettings={{ ...(widgetSettings || {}), storeName: merchant.storeName || '' }}
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
            initialSettings={safePaymentSettings}
          />
        </TabsContent>

        <TabsContent value="plan" className="space-y-4">
          <PlanSettingsClient
            currentPlan={merchant.checkoutPlan}
            plans={planOptions}
            feeSummary={{
              orders: feeTotals._count,
              sales: feeTotals._sum.total ?? 0,
              fees: feeTotals._sum.feeAmount ?? 0,
            }}
          />
        </TabsContent>

        <TabsContent value="discounts" className="space-y-4">
          <Card className="shadow-sm border-slate-200">
            <CardHeader>
              <CardTitle>Discounts</CardTitle>
              <CardDescription>Your checkout uses the discounts you create in Shopify.</CardDescription>
            </CardHeader>
            <CardContent>
              <a
                href={`https://${merchant.shopDomain}/admin/discounts`}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-slate-900 underline"
              >
                Manage discounts in Shopify
              </a>
            </CardContent>
          </Card>
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
