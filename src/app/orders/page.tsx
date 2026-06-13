import { prisma } from '@/lib/prisma';

export default async function OrdersPage() {
  let orders: any[] = [];
  try {
    orders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  } catch (err) {
    // Return empty list if DB isn't ready
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-slate-800">Orders</h1>
        <button className="bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-600">
          Sync Orders
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-sm font-medium text-slate-500">
                <th className="p-4">Order ID</th>
                <th className="p-4">Customer</th>
                <th className="p-4">Product</th>
                <th className="p-4">Total</th>
                <th className="p-4">Payment</th>
                <th className="p-4">Status</th>
                <th className="p-4">Date</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No orders found. Use the test widget on the overview page to create one.
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="p-4 font-medium text-slate-800">{order.shopifyOrderId || 'Pending'}</td>
                    <td className="p-4">
                      <div className="font-medium text-slate-800">{order.customerName}</div>
                      <div className="text-slate-500 text-xs">{order.customerPhone}</div>
                    </td>
                    <td className="p-4">{order.productTitle} <span className="text-slate-400">x{order.quantity}</span></td>
                    <td className="p-4 font-medium">₹{order.total}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${order.paymentMethod === 'COD' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                        {order.paymentMethod}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${order.orderStatus === 'Synced' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                        {order.orderStatus}
                      </span>
                    </td>
                    <td className="p-4 text-slate-500">{new Date(order.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
