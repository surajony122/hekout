import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import CustomersClient from './CustomersClient';

export const dynamic = 'force-dynamic';

export default async function CustomersPage() {
  const cookieStore = await cookies();
  const shop = cookieStore.get('shop_domain')?.value;

  if (!shop) {
    redirect('/');
  }

  const merchant = await prisma.merchant.findUnique({
    where: { shopDomain: shop }
  });

  if (!merchant) {
    redirect('/');
  }

  const customers = await prisma.customerProfile.findMany({
    where: { merchantId: merchant.id },
    orderBy: { lastOrderAt: 'desc' }
  });

  return <CustomersClient customers={customers} />;
}
