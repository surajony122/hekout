import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { getLoggedInMerchant } from '@/lib/merchant-auth';
import CustomersClient from './CustomersClient';

export const dynamic = 'force-dynamic';

export default async function CustomersPage() {
  const merchant = await getLoggedInMerchant();
  if (!merchant) redirect('/login');

  let customers: any[] = [];

  try {
    customers = await prisma.customerProfile.findMany({
      where: { merchantId: merchant.id },
      orderBy: { lastOrderAt: 'desc' }
    });
  } catch (err) {
    console.error(err);
  }

  // Serialize Date objects to avoid Next.js Error: "Only plain objects can be passed to Client Components from Server Components"
  const serializedCustomers = JSON.parse(JSON.stringify(customers));

  return <CustomersClient customers={serializedCustomers} />;
}
