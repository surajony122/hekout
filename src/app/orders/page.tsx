import { prisma } from '@/lib/prisma';
import { Search, ChevronDown, Download, Eye, ExternalLink } from 'lucide-react';
import Link from 'next/link';

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

  return (
    <div className="bg-[#f4f7fe] min-h-screen p-4 md:p-8 font-sans text-slate-800">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Orders</h1>
          <p className="text-slate-500 text-sm mt-1">Track and manage all customer orders</p>
        </div>
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm">
            <span>Sync Orders</span>
          </button>
          <button className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm">
            <Download size={16} className="text-slate-500" />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] overflow-x-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Search orders..." className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm w-64 focus:outline-none focus:border-indigo-500" />
          </div>
          <div className="flex gap-3">
            <button className="flex items-center gap-2 border border-slate-200 px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50">
              Date <ChevronDown size={16} />
            </button>
            <button className="flex items-center gap-2 border border-slate-200 px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50">
              Status <ChevronDown size={16} />
            </button>
          </div>
        </div>

        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 rounded-lg">
              <th className="py-3 px-4 text-sm font-semibold text-slate-500 first:rounded-l-lg">Order ID</th>
              <th className="py-3 px-4 text-sm font-semibold text-slate-500">Products</th>
              <th className="py-3 px-4 text-sm font-semibold text-slate-500">Customer</th>
              <th className="py-3 px-4 text-sm font-semibold text-slate-500">Date</th>
              <th className="py-3 px-4 text-sm font-semibold text-slate-500">Amount</th>
              <th className="py-3 px-4 text-sm font-semibold text-slate-500">Payment</th>
              <th className="py-3 px-4 text-sm font-semibold text-slate-500">Status</th>
              <th className="py-3 px-4 text-sm font-semibold text-slate-500 text-center last:rounded-r-lg">Action</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr><td colSpan={8} className="py-12 text-center text-slate-500">No orders found. Use the test widget on the overview page to create one.</td></tr>
            ) : (
              orders.map((order) => {
                let productNames = order.productTitle || 'Unknown';

                const isCompleted = order.orderStatus === 'Synced';
                const shopifyUrl = order.shopifyOrderId ? `https://${shopDomain}/admin/orders/${order.shopifyOrderId}` : '#';

                return (
                  <tr key={order.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-4 font-medium text-slate-900">
                      {order.shopifyOrderId ? `#${order.shopifyOrderId}` : 'Pending Sync'}
                    </td>
                    <td className="py-4 px-4 text-sm text-slate-600 flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-lg">🛍️</div>
                      <span className="truncate max-w-[150px]">{productNames}</span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-sm font-medium text-slate-900">{order.customerName || 'Guest'}</div>
                      <div className="text-xs text-slate-500">{order.customerPhone}</div>
                    </td>
                    <td className="py-4 px-4 text-sm text-slate-500">
                      {new Date(order.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-4 px-4 text-sm font-medium text-slate-900">₹{order.total.toLocaleString()}</td>
                    <td className="py-4 px-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${order.paymentMethod === 'COD' ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
                        {order.paymentMethod}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${isCompleted ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                        {isCompleted ? 'Completed' : 'Pending'}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <a href={shopifyUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-colors p-1.5 hover:bg-indigo-50 rounded-md" title="View in Shopify">
                        <ExternalLink size={18} />
                      </a>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
