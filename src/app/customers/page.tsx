import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import CustomersClient from './CustomersClient';

export const dynamic = 'force-dynamic';

export default async function CustomersPage() {
  let customers: any[] = [];

  try {
    // Try to get from cookie first
    const cookieStore = await cookies();
    let shop = cookieStore.get('shop_domain')?.value;

    let merchant;
    if (shop) {
      merchant = await prisma.merchant.findUnique({
        where: { shopDomain: shop }
      });
    }

    // Fallback to first active merchant if no cookie (for testing the URL directly)
    if (!merchant) {
      merchant = await prisma.merchant.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' }
      });
    }

    if (merchant) {
      customers = await prisma.customerProfile.findMany({
        where: { merchantId: merchant.id },
        orderBy: { lastOrderAt: 'desc' }
      });
    }
  } catch (err) {
    console.error(err);
  }

  // Serialize Date objects to avoid Next.js Error: "Only plain objects can be passed to Client Components from Server Components"
  const serializedCustomers = JSON.parse(JSON.stringify(customers));

  return <CustomersClient customers={serializedCustomers} />;
}
