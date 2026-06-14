export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import PaymentSettingsClient from './PaymentSettingsClient';

export default async function SettingsPage() {
  let merchant = null;
  let paymentSettings = null;

  try {
    merchant = await prisma.merchant.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' }
    });

    if (merchant) {
      paymentSettings = await prisma.paymentSettings.findUnique({
        where: { merchantId: merchant.id }
      });
    }
  } catch (error) {
    console.error('Error fetching settings:', error);
  }

  return (
    <div className="bg-[#f4f7fe] min-h-screen p-4 md:p-8 font-sans text-slate-800">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
          <p className="text-slate-500 text-sm mt-1">Configure your store's payment gateways and discounts.</p>
        </div>

        <PaymentSettingsClient 
          merchantId={merchant?.id || ''} 
          initialSettings={paymentSettings || {}} 
        />
      </div>
    </div>
  );
}
