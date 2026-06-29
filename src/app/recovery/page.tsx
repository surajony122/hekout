import { prisma } from '@/lib/prisma';
import RecoveryClient from './RecoveryClient';

export const dynamic = 'force-dynamic';

export default async function RecoveryPage() {
  let abandonedOrders: any[] = [];
  
  try {
    const merchant = await prisma.merchant.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' }
    });
    
    if (merchant) {
      abandonedOrders = await prisma.order.findMany({
        where: { 
          merchantId: merchant.id,
          orderStatus: { in: ['Pending', 'Draft_Created', 'Failed'] }
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
    }
  } catch (err) {
    console.error(err);
  }

  return <RecoveryClient abandonedOrders={abandonedOrders} />;
}
