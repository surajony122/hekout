import { redirect } from 'next/navigation';
import Script from 'next/script';
import { prisma } from '@/lib/prisma';
import { getLoggedInMerchant } from '@/lib/merchant-auth';
import DashboardClient from './components/DashboardClient';
import SetupChecklist from '@/components/SetupChecklist';
import { planAllowsOnlinePayments } from '@/lib/plans';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const merchant = await getLoggedInMerchant();
  if (!merchant) redirect('/login');

  const [widgetUsed, orderPlaced, paymentSettings] = await Promise.all([
    prisma.analyticsEvent.findFirst({ where: { merchantId: merchant.id }, select: { id: true } }),
    prisma.order.findFirst({ where: { merchantId: merchant.id, orderStatus: 'Synced' }, select: { id: true } }),
    prisma.paymentSettings.findUnique({ where: { merchantId: merchant.id }, select: { razorpayKeyId: true } }),
  ]);

  const activateUrl = `https://${merchant.shopDomain}/admin/themes/current/editor?context=apps&template=product&activateAppId=${process.env.SHOPIFY_CLIENT_ID}/checkout-button`;

  return (
    <>
      <SetupChecklist
        activateUrl={activateUrl}
        storefrontUrl={`https://${merchant.shopDomain}`}
        buttonEnabled={Boolean(widgetUsed)}
        paymentsConnected={Boolean(paymentSettings?.razorpayKeyId)}
        showPaymentsStep={planAllowsOnlinePayments(merchant.checkoutPlan)}
        orderPlaced={Boolean(orderPlaced)}
      />
      <DashboardClient />
      <Script src="/widget.js" strategy="lazyOnload" />
    </>
  );
}
