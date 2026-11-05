import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { getLoggedInMerchant } from '@/lib/merchant-auth';
import RecoveryClient from './RecoveryClient';

export const dynamic = 'force-dynamic';

export default async function RecoveryPage() {
  const merchant = await getLoggedInMerchant();
  if (!merchant) redirect('/login');

  let abandonedOrders: any[] = [];

  try {
    abandonedOrders = await prisma.order.findMany({
      where: {
        merchantId: merchant.id,
        paymentId: null,
        orderStatus: { in: ['Pending', 'Draft_Created', 'Failed', 'Awaiting_Payment'] }
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  } catch (err) {
    console.error(err);
  }

  return <RecoveryClient abandonedOrders={abandonedOrders} />;
}
