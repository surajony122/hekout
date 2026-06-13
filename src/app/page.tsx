import { prisma } from '@/lib/prisma';

// Helper to safely fetch data despite Postgres not being fully seeded yet
async function getDashboardData() {
  try {
    const orders = await prisma.order.count();
    const customers = await prisma.customerProfile.count();
    
    const allOrders = await prisma.order.findMany({ select: { total: true }});
    const revenue = allOrders.reduce((sum, order) => sum + order.total, 0);

    return { orders, customers, revenue };
  } catch (error) {
    // Return 0s if DB fails (e.g. before migrations run)
    return { orders: 0, customers: 0, revenue: 0 };
  }
}

import TestWidgetButton from './components/TestWidgetButton';
import Script from 'next/script';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const stats = await getDashboardData();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-slate-800">Overview</h1>
        <button className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800">
          Last 30 Days
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500 font-medium">Total Revenue</p>
          <p className="text-3xl font-bold text-slate-800 mt-2">₹{stats.revenue.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500 font-medium">Total Orders</p>
          <p className="text-3xl font-bold text-slate-800 mt-2">{stats.orders.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500 font-medium">Total Customers</p>
          <p className="text-3xl font-bold text-slate-800 mt-2">{stats.customers.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500 font-medium">Conversion Rate</p>
          <p className="text-3xl font-bold text-emerald-600 mt-2">3.4%</p>
        </div>
      </div>

      {/* Test Widget Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8 mt-8 text-center max-w-2xl mx-auto">
        <h2 className="text-xl font-bold text-slate-800 mb-2">Test Your Checkout Widget</h2>
        <p className="text-slate-500 mb-6">Click below to simulate how the CheckoutFlow bottom-sheet widget appears on your Shopify storefront.</p>
        
        <TestWidgetButton />
      </div>

      <Script src="/widget.js" strategy="lazyOnload" />
    </div>
  );
}
