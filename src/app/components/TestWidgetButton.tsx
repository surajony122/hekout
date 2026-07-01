'use client';

import { toast } from 'sonner';

export default function TestWidgetButton() {
  const handleClick = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof window !== 'undefined' && (window as any).CheckoutFlow) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).CheckoutFlow.open({
        shop: 'demo.myshopify.com',
        variantId: '123',
        quantity: 1,
        productTitle: 'Premium Headphones',
        price: '2999'
      });
    } else {
      toast.error('Widget script not loaded yet!');
    }
  };

  return (
    <button 
      onClick={handleClick}
      className="bg-emerald-500 text-white px-6 py-3 rounded-lg font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-600 transition"
    >
      Simulate "Buy Now" Click
    </button>
  );
}
