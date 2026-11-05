import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { getLoggedInMerchant } from '@/lib/merchant-auth';
import OrdersClient from './OrdersClient';

export const dynamic = 'force-dynamic';

export default async function OrdersPage() {
  const merchant = await getLoggedInMerchant();
  if (!merchant) redirect('/login');

  let orders: any[] = [];
  try {
    orders = await prisma.order.findMany({
      where: { merchantId: merchant.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  } catch (err) {}

  const serializedOrders = JSON.parse(JSON.stringify(orders));

  return <OrdersClient orders={serializedOrders} shopDomain={merchant.shopDomain} />;
}
