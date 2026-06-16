import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const shop = cookieStore.get('shop_domain')?.value;

    if (!shop) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const merchant = await prisma.merchant.findUnique({
      where: { shopDomain: shop }
    });

    if (!merchant) {
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    // 1. Basic Metrics
    const orders = await prisma.order.findMany({
      where: { merchantId: merchant.id, orderStatus: 'Synced' },
      select: { 
        id: true,
        total: true, 
        paymentMethod: true, 
        createdAt: true,
        orderStatus: true,
        customerName: true,
        productTitle: true,
        price: true,
        quantity: true,
        prepaidDiscount: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
    const aov = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const totalPrepaidDiscount = orders.reduce((sum, order) => sum + (order.prepaidDiscount || 0), 0);
        const totalDiscountsGiven = totalPrepaidDiscount;

    const codOrders = orders.filter(o => o.paymentMethod === 'COD').length;
    const prepaidOrders = orders.filter(o => o.paymentMethod !== 'COD').length;

    // Recent Orders (Last 5)
    const recentOrders = orders.slice(0, 5).map(o => {
      const productNames = o.productTitle || 'Unknown';
      
      return {
        id: `#${o.id.substring(o.id.length - 5)}`,
        products: productNames,
        customer: o.customerName || 'Guest',
        date: new Date(o.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
        amount: o.total,
        status: o.orderStatus === 'Synced' ? 'Completed' : 'Pending'
      };
    });

    // Top Products
    const productEarnings: Record<string, number> = {};
    orders.forEach(o => {
      const title = o.productTitle || 'Unknown';
      const price = o.price || 0;
      const qty = o.quantity || 1;
      productEarnings[title] = (productEarnings[title] || 0) + (price * qty);
    });

    const topProducts = Object.entries(productEarnings)
      .map(([name, earnings]) => ({ name, earnings }))
      .sort((a, b) => b.earnings - a.earnings)
      .slice(0, 3)
      .map(p => ({
        name: p.name,
        earnings: p.earnings,
        percent: totalRevenue > 0 ? Math.round((p.earnings / totalRevenue) * 100) : 0
      }));

    // 2. Funnel Analytics
    const events = await prisma.analyticsEvent.findMany({
      where: { merchantId: merchant.id },
      select: { eventName: true }
    });

    const widgetOpened = events.filter(e => e.eventName === 'WIDGET_OPENED').length;
    const phoneEntered = events.filter(e => e.eventName === 'PHONE_ENTERED').length;
    const otpVerified = events.filter(e => e.eventName === 'OTP_VERIFIED').length;
    
    // We can use actual completed orders for the final funnel step
    const orderCompleted = totalOrders;

    const conversionRate = widgetOpened > 0 ? ((orderCompleted / widgetOpened) * 100).toFixed(2) : 0;

    // 3. Daily Revenue (Last 7 Days)
    const last7Days = Array.from({length: 7}, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    const revenueByDay = last7Days.map(date => {
      const dayOrders = orders.filter(o => o.createdAt.toISOString().split('T')[0] === date);
      const rev = dayOrders.reduce((sum, o) => sum + o.total, 0);
      // Format date string for display (e.g. "Jun 13")
      const displayDate = new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return { date: displayDate, revenue: rev };
    });

    return NextResponse.json({
      success: true,
      metrics: {
        totalOrders,
        totalRevenue,
        aov,
        totalDiscountsGiven,
        totalPrepaidDiscount,
        conversionRate,
        paymentSplit: [
          { name: 'COD', value: codOrders },
          { name: 'Prepaid', value: prepaidOrders }
        ],
        funnel: [
          { step: 'Widget Opened', users: widgetOpened },
          { step: 'Phone Entered', users: phoneEntered },
          { step: 'OTP Verified', users: otpVerified },
          { step: 'Order Placed', users: orderCompleted }
        ],
        revenueTrend: revenueByDay,
        recentOrders,
        topProducts
      }
    });

  } catch (error) {
    console.error('Dashboard Metrics Error:', error);
    return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 });
  }
}
