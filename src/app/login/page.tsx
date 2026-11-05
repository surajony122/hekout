import { redirect } from 'next/navigation';
import { getLoggedInMerchant } from '@/lib/merchant-auth';

export const dynamic = 'force-dynamic';

const ERROR_MESSAGES: Record<string, string> = {
  invalid_shop: 'Enter a valid store name, like my-store.myshopify.com.',
  invalid_state: 'Your login session expired. Please try again.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getLoggedInMerchant()) redirect('/');

  const { error } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] || 'We could not log you in. Please try again.' : null;

  return (
    <div className="w-full flex items-center justify-center p-4 overflow-auto">
      <div className="w-full max-w-sm bg-white border border-slate-200 rounded-xl shadow-sm p-6 md:p-8">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Log in to CheckoutFlow</h1>
        <p className="text-sm text-slate-500 mt-1 mb-6">Enter your Shopify store. You&apos;ll confirm your login on Shopify.</p>

        {errorMessage && (
          <p role="alert" className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2 mb-4">
            {errorMessage}
          </p>
        )}

        <form action="/api/auth/shopify" method="get" className="space-y-4">
          <div>
            <label htmlFor="shop" className="block text-sm font-medium text-slate-700 mb-1">Store domain</label>
            <input
              id="shop"
              name="shop"
              type="text"
              required
              autoFocus
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="my-store.myshopify.com"
              className="w-full px-3 py-2 text-base md:text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2 text-sm font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors"
          >
            Continue with Shopify
          </button>
        </form>
      </div>
    </div>
  );
}
