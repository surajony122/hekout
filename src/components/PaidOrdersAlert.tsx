'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';

type PaidOrder = {
  id: string;
  customerName: string | null;
  customerPhone: string | null;
  total: number;
  paymentId: string | null;
};

// Customers here have paid, but their order isn't in Shopify yet.
export default function PaidOrdersAlert({ orders }: { orders: PaidOrder[] }) {
  const router = useRouter();
  const [retrying, setRetrying] = useState<string | null>(null);

  const retry = async (id: string) => {
    setRetrying(id);
    try {
      const res = await fetch('/api/orders/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('The order is now in Shopify.');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : 'Could not retry this order.');
    } finally {
      setRetrying(null);
    }
  };

  if (orders.length === 0) return null;

  return (
    <section role="alert" className="mb-6 bg-rose-50 border border-rose-200 rounded-xl p-4 md:p-6">
      <h2 className="flex items-center gap-2 text-base font-bold text-rose-900">
        <AlertTriangle size={18} aria-hidden="true" />
        {orders.length === 1 ? '1 paid order needs your attention' : `${orders.length} paid orders need your attention`}
      </h2>
      <p className="mt-1 text-sm text-rose-800">
        These customers have paid, but Shopify could not create their order. We keep retrying. If it keeps failing, create the order in Shopify or refund the customer in Razorpay.
      </p>
      <ul className="mt-3 divide-y divide-rose-200">
        {orders.map((order) => (
          <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0 text-sm text-rose-950">
              <p className="font-medium">{order.customerName || 'Customer'} · ₹{order.total.toLocaleString('en-IN')}</p>
              <p className="text-rose-800 break-all">{order.customerPhone} · Payment {order.paymentId}</p>
            </div>
            <button
              type="button"
              onClick={() => retry(order.id)}
              disabled={retrying !== null}
              className="shrink-0 px-3 py-1.5 text-sm font-medium text-white bg-rose-700 rounded-md hover:bg-rose-800 disabled:opacity-60 transition-colors"
            >
              {retrying === order.id ? 'Retrying...' : 'Retry now'}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
