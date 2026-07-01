import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    let shop = cookieStore.get('shop_domain')?.value;

    let merchant = null;
    
    if (shop) {
      merchant = await prisma.merchant.findUnique({
        where: { shopDomain: shop }
      });
    }

    // Fallback to first active merchant if no cookie (for direct testing)
    if (!merchant) {
      merchant = await prisma.merchant.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' }
      });
    }

    if (!merchant) {
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    // 1. Fetch all COD orders
    const codOrders = await prisma.order.findMany({
      where: { 
        merchantId: merchant.id,
        paymentMethod: 'COD'
      },
      select: {
        city: true,
        state: true,
        orderStatus: true,
        total: true,
      }
    });

    // 2. Aggregate data by City and State
    // We will group by a composite key: "City, State"
    const locationStats: Record<string, { city: string, state: string, totalOrders: number, failedOrders: number, totalRevenueSaved: number }> = {};
    let totalHighRiskBlocked = 0;
    let totalPotentialRtoSaved = 0;

    codOrders.forEach(order => {
      // Normalize city and state strings
      const city = order.city?.trim() || 'Unknown City';
      const state = order.state?.trim() || 'Unknown State';
      
      // Skip if both are unknown
      if (city === 'Unknown City' && state === 'Unknown State') return;

      const key = `${city}___${state}`;

      if (!locationStats[key]) {
        locationStats[key] = {
          city,
          state,
          totalOrders: 0,
          failedOrders: 0,
          totalRevenueSaved: 0
        };
      }

      locationStats[key].totalOrders += 1;

      // If the order failed (e.g. RTO), count it
      if (order.orderStatus === 'Failed' || order.orderStatus === 'Cancelled') {
        locationStats[key].failedOrders += 1;
        locationStats[key].totalRevenueSaved += (order.total || 0);
        totalHighRiskBlocked += 1;
        totalPotentialRtoSaved += (order.total || 0);
      }
    });

    // 3. Format and Calculate Risk Score
    const highRiskAreas = Object.values(locationStats).map(stat => {
      const rtoRatePercent = stat.totalOrders > 0 ? (stat.failedOrders / stat.totalOrders) * 100 : 0;
      
      // Calculate a basic risk score. 
      // This is a simple algorithm: RTO % forms the base, heavily penalized by sheer volume of failed orders.
      // Max score is capped at 100.
      let riskScore = rtoRatePercent + (stat.failedOrders * 2);
      if (riskScore > 100) riskScore = 100;
      if (riskScore < 0) riskScore = 0;

      return {
        city: stat.city,
        state: stat.state,
        orders: stat.totalOrders,
        rtoRate: `${rtoRatePercent.toFixed(1)}%`,
        rtoRateRaw: rtoRatePercent,
        riskScore: Math.round(riskScore),
      };
    });

    // Sort by riskScore descending, only return top 20
    highRiskAreas.sort((a, b) => b.riskScore - a.riskScore);
    const topHighRiskAreas = highRiskAreas.slice(0, 20);

    return NextResponse.json({
      success: true,
      metrics: {
        totalCodOrders: codOrders.length,
        highRiskBlocked: totalHighRiskBlocked,
        potentialRtoSaved: totalPotentialRtoSaved,
        highRiskAreas: topHighRiskAreas,
      }
    });

  } catch (error) {
    console.error('COD Intel Error:', error);
    return NextResponse.json({ error: 'Failed to fetch COD Intel data' }, { status: 500 });
  }
}
