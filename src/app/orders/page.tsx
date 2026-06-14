import { prisma } from '@/lib/prisma';
import { Search, ChevronDown, Download, Eye, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import OrdersClient from './OrdersClient';

export const dynamic = 'force-dynamic';

export default async function OrdersPage() {
  let orders: any[] = [];
  let shopDomain = '';
  try {
    const merchant = await prisma.merchant.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' }
    });
    
    if (merchant) {
      shopDomain = merchant.shopDomain;
      orders = await prisma.order.findMany({
        where: { merchantId: merchant.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    }
  } catch (err) {}

  return <OrdersClient orders={orders} shopDomain={shopDomain} />;
}
