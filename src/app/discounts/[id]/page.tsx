import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, TrendingUp, Users, DollarSign, Activity } from 'lucide-react';
import DiscountEditForm from './DiscountEditForm';

export const dynamic = 'force-dynamic';

export default async function DiscountDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const coupon = await prisma.coupon.findUnique({
    where: { id }
  });

  if (!coupon) {
    notFound();
  }

  // Analytics Query
  // Find all orders that used this coupon
  const orders = await prisma.order.findMany({
    where: {
      merchantId: coupon.merchantId,
      couponCode: { equals: coupon.code, mode: 'insensitive' }
    },
    orderBy: { createdAt: 'desc' }
  });

  const totalUses = orders.length;
  
  // Calculate total revenue from these orders (only synced or pending, not failed)
  const validOrders = orders.filter(o => o.orderStatus !== 'Failed');
  const totalRevenue = validOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const totalDiscountGiven = validOrders.reduce((sum, o) => sum + (o.couponDiscount || 0), 0);

  return (
    <div className="bg-[#f4f7fe] min-h-screen p-4 md:p-8 font-sans text-slate-800">
      
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/discounts" className="p-2 bg-white rounded-full shadow-sm hover:bg-slate-50 transition-colors text-slate-500">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            Discount: <span className="text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100">{coupon.code}</span>
          </h1>
          <p className="text-slate-500 text-sm mt-1">Manage details and view performance analytics</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Analytics Summary Cards */}
        <div className="col-span-1 lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] flex flex-col justify-center">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600"><Users size={20} /></div>
              <h3 className="text-slate-500 text-sm font-medium">Total Uses</h3>
            </div>
            <p className="text-3xl font-bold text-slate-900">{totalUses}</p>
          </div>
          
          <div className="bg-white p-6 rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] flex flex-col justify-center">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600"><DollarSign size={20} /></div>
              <h3 className="text-slate-500 text-sm font-medium">Revenue Generated</h3>
            </div>
            <p className="text-3xl font-bold text-slate-900">₹{totalRevenue.toFixed(2)}</p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] flex flex-col justify-center">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-rose-50 rounded-lg text-rose-600"><TrendingUp size={20} /></div>
              <h3 className="text-slate-500 text-sm font-medium">Discount Given</h3>
            </div>
            <p className="text-3xl font-bold text-slate-900">₹{totalDiscountGiven.toFixed(2)}</p>
          </div>
        </div>

        {/* Edit Form */}
        <div className="col-span-1">
          <DiscountEditForm coupon={coupon} />
        </div>
      </div>

      {/* Recent Usage Table */}
      <div className="bg-white p-6 rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] overflow-x-auto">
        <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2"><Activity size={18} className="text-indigo-500"/> Recent Usage</h2>
        
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 rounded-lg">
              <th className="py-3 px-4 text-sm font-semibold text-slate-500 first:rounded-l-lg">Customer</th>
              <th className="py-3 px-4 text-sm font-semibold text-slate-500">Order ID</th>
              <th className="py-3 px-4 text-sm font-semibold text-slate-500">Date</th>
              <th className="py-3 px-4 text-sm font-semibold text-slate-500">Discount Saved</th>
              <th className="py-3 px-4 text-sm font-semibold text-slate-500 last:rounded-r-lg">Final Total</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr><td colSpan={5} className="py-8 text-center text-slate-500">No orders have used this coupon yet.</td></tr>
            ) : (
              orders.slice(0, 10).map((order) => (
                <tr key={order.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                  <td className="py-4 px-4 font-medium text-slate-900">
                    {order.customerName || 'Guest'}
                    <div className="text-xs text-slate-500">{order.customerPhone}</div>
                  </td>
                  <td className="py-4 px-4 text-sm text-slate-600">
                    #{order.id.slice(-6).toUpperCase()}
                  </td>
                  <td className="py-4 px-4 text-sm text-slate-500">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-4 px-4 text-sm font-medium text-rose-500">
                    -₹{order.couponDiscount}
                  </td>
                  <td className="py-4 px-4 text-sm font-bold text-emerald-600">
                    ₹{order.total}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
