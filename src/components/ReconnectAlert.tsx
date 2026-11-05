import { AlertTriangle } from 'lucide-react';

// Shows when the store's Shopify connection is out of date, with the one step that fixes it.
export default function ReconnectAlert({ shopDomain }: { shopDomain: string }) {
  return (
    <section role="alert" className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 md:p-6">
      <h2 className="flex items-center gap-2 text-base font-bold text-amber-950">
        <AlertTriangle size={18} aria-hidden="true" />
        Reconnect your store
      </h2>
      <p className="mt-1 text-sm text-amber-900">
        Your store&apos;s connection to Shopify is out of date. Until you reconnect, customers&apos; details won&apos;t fill in on Shopify checkout, and orders may not reach Shopify. Shopify will ask you to approve the app&apos;s permissions.
      </p>
      <a
        href={`/api/auth/shopify?shop=${encodeURIComponent(shopDomain)}`}
        className="inline-block mt-3 px-3 py-1.5 text-sm font-medium text-white bg-amber-800 rounded-md hover:bg-amber-900 transition-colors"
      >
        Reconnect store
      </a>
    </section>
  );
}
