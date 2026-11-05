import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { getLoggedInMerchant } from '@/lib/merchant-auth';
import PaymentSettingsClient from './PaymentSettingsClient';
import WidgetSettingsClient from './WidgetSettingsClient';
import PlanSettingsClient from './PlanSettingsClient';
import ShippingSettingsClient from './ShippingSettingsClient';
import IntegrationsClient from './IntegrationsClient';
import { OTP_RULES, smsProviderStatus } from '@/lib/otp-rules';
import ReconnectAlert from '@/components/ReconnectAlert';
import { storeNeedsReconnect } from '@/lib/shopify-connection';
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

  const sms = smsProviderStatus();
  const needsReconnect = await storeNeedsReconnect(merchant);
  const currentPlanName = planOptions.find((plan) => plan.id === merchant.checkoutPlan)?.name ?? 'Full Checkout';

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

      {needsReconnect && <ReconnectAlert shopDomain={merchant.shopDomain} />}

      <Tabs defaultValue="payments" className="w-full">
        <TabsList className="bg-slate-100/50 p-1 mb-6 flex space-x-2 w-max">
          <TabsTrigger value="general" className="text-xs">General</TabsTrigger>
          <TabsTrigger value="widget" className="text-xs">Widget Design</TabsTrigger>
          <TabsTrigger value="otp" className="text-xs">OTP</TabsTrigger>
          <TabsTrigger value="payments" className="text-xs">Payments</TabsTrigger>
          <TabsTrigger value="plan" className="text-xs">Plan & Fees</TabsTrigger>
          <TabsTrigger value="discounts" className="text-xs">Discounts</TabsTrigger>
          <TabsTrigger value="shipping" className="text-xs">Shipping</TabsTrigger>
          <TabsTrigger value="integrations" className="text-xs">Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card className="shadow-sm border-slate-200">
            <CardHeader>
              <CardTitle>Store details</CardTitle>
              <CardDescription>The store connected to this dashboard.</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div><dt className="text-slate-500">Store name</dt><dd className="mt-1 font-medium text-slate-900">{merchant.storeName || 'Not set. Add it under Widget Design'}</dd></div>
                <div><dt className="text-slate-500">Shopify address</dt><dd className="mt-1 font-medium text-slate-900 break-all">{merchant.shopDomain}</dd></div>
                <div><dt className="text-slate-500">Plan</dt><dd className="mt-1 font-medium text-slate-900">{currentPlanName}</dd></div>
                <div><dt className="text-slate-500">Connected since</dt><dd className="mt-1 font-medium text-slate-900">{merchant.createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}</dd></div>
              </dl>
              <a href={`https://${merchant.shopDomain}/admin`} target="_blank" rel="noreferrer" className="inline-block mt-4 text-sm font-medium text-slate-900 underline">Open Shopify admin</a>
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
              <CardDescription>How customers verify their phone number. These rules protect your store and SMS costs, and apply automatically.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-900">
                <span className="text-slate-500">SMS provider: </span>
                <span className={`font-medium ${sms.live ? 'text-emerald-700' : 'text-rose-700'}`}>{sms.name}</span>
              </p>
              {!sms.live && <p role="alert" className="text-sm text-rose-700">Customers won&apos;t receive real codes until an SMS provider is connected.</p>}
              <ul className="list-disc pl-5 space-y-1 text-sm text-slate-600">
                <li>Codes have 6 digits and last {OTP_RULES.ttlMinutes} minutes, with {OTP_RULES.maxAttempts} tries each.</li>
                <li>Customers can ask for a new code every {OTP_RULES.resendSeconds} seconds, up to {OTP_RULES.perPhonePer10Min} in 10 minutes and {OTP_RULES.perPhonePerDay} a day.</li>
                <li>One connection can request {OTP_RULES.perConnectionPer10Min} codes in 10 minutes and {OTP_RULES.perConnectionPerDay} a day.</li>
                <li>Your store can send up to {OTP_RULES.perStorePerHour} codes an hour.</li>
                <li>Only Indian mobile numbers are accepted.</li>
                <li>Customers stay verified on their device for {OTP_RULES.verifiedHours} hours.</li>
              </ul>
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
          <ShippingSettingsClient
            initial={{
              isShippingFeeEnabled: paymentSettings?.isShippingFeeEnabled ?? false,
              shippingFeeAmount: paymentSettings?.shippingFeeAmount ?? 0,
              freeShippingThreshold: paymentSettings?.freeShippingThreshold ?? 999,
            }}
          />
        </TabsContent>

        <TabsContent value="integrations" className="space-y-4">
          <IntegrationsClient initialPixelId={widgetSettings?.fbPixelId ?? ''} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
