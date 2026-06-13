'use client';

export default function TestWidgetButton() {
  const handleClick = () => {
    if (typeof window !== 'undefined' && (window as any).CheckoutFlow) {
      (window as any).CheckoutFlow.open({
        shop: 'demo.myshopify.com',
        variantId: '123',
        quantity: 1,
        productTitle: 'Premium Headphones',
        price: '2999'
      });
    } else {
      alert('Widget script not loaded yet!');
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
