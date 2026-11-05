import { redirect } from 'next/navigation';
import Script from 'next/script';
import { prisma } from '@/lib/prisma';
import { getLoggedInMerchant } from '@/lib/merchant-auth';
import DashboardClient from './components/DashboardClient';
import SetupChecklist from '@/components/SetupChecklist';
import PaidOrdersAlert from '@/components/PaidOrdersAlert';
import ReconnectAlert from '@/components/ReconnectAlert';
import { storeNeedsReconnect } from '@/lib/shopify-connection';
import { planAllowsOnlinePayments, planAllowsPartialCod } from '@/lib/plans';
import { reconcileInBackground } from '@/lib/order-fulfillment';
import { isEncryptionConfigured, isProtected, protectSecret } from '@/lib/secrets';

export const dynamic = 'force-dynamic';

// Secrets saved before encryption was added are encrypted the next time the owner visits.
async function encryptExistingSecrets(
  merchant: { id: string; accessToken: string | null },
  settings: { merchantId: string; razorpayKeySecret: string | null; cashfreeSecretKey: string | null } | null
) {
  if (!isEncryptionConfigured()) return;
  if (merchant.accessToken && !isProtected(merchant.accessToken)) {
    await prisma.merchant.update({ where: { id: merchant.id }, data: { accessToken: protectSecret(merchant.accessToken) } });
  }
  if (settings) {
    const updates: { razorpayKeySecret?: string; cashfreeSecretKey?: string } = {};
    if (settings.razorpayKeySecret && !isProtected(settings.razorpayKeySecret)) updates.razorpayKeySecret = protectSecret(settings.razorpayKeySecret);
    if (settings.cashfreeSecretKey && !isProtected(settings.cashfreeSecretKey)) updates.cashfreeSecretKey = protectSecret(settings.cashfreeSecretKey);
    if (Object.keys(updates).length > 0) {
      await prisma.paymentSettings.update({ where: { merchantId: settings.merchantId }, data: updates });
    }
  }
}

export default async function Home() {
  const merchant = await getLoggedInMerchant();
  if (!merchant) redirect('/login');

  const [widgetUsed, orderPlaced, paymentSettings, paidOrders] = await Promise.all([
    prisma.analyticsEvent.findFirst({ where: { merchantId: merchant.id }, select: { id: true } }),
    prisma.order.findFirst({ where: { merchantId: merchant.id, orderStatus: 'Synced' }, select: { id: true } }),
    prisma.paymentSettings.findUnique({ where: { merchantId: merchant.id }, }),
    prisma.order.findMany({
      where: { merchantId: merchant.id, paymentId: { not: null }, orderStatus: { in: ['Needs_Attention', 'Processing'] } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, customerName: true, customerPhone: true, total: true, paymentId: true },
      take: 20,
    }),
  ]);

  reconcileInBackground({ ...merchant, paymentSettings });
  await encryptExistingSecrets(merchant, paymentSettings);
  const needsReconnect = await storeNeedsReconnect(merchant);

  const activateUrl = `https://${merchant.shopDomain}/admin/themes/current/editor?context=apps&template=product&activateAppId=${process.env.SHOPIFY_CLIENT_ID}/checkout-button`;

  return (
    <>
      {needsReconnect && <ReconnectAlert shopDomain={merchant.shopDomain} />}
      <PaidOrdersAlert orders={paidOrders} />
      <SetupChecklist
        activateUrl={activateUrl}
        storefrontUrl={`https://${merchant.shopDomain}`}
        buttonEnabled={Boolean(widgetUsed)}
        paymentsConnected={Boolean(paymentSettings?.razorpayKeyId)}
        showPaymentsStep={planAllowsOnlinePayments(merchant.checkoutPlan) || (planAllowsPartialCod(merchant.checkoutPlan) && Boolean(paymentSettings?.isPartialCodEnabled))}
        orderPlaced={Boolean(orderPlaced)}
      />
      <DashboardClient />
      <Script src="/widget.js" strategy="lazyOnload" />
    </>
  );
}
