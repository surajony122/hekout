import Link from 'next/link';
import { CheckCircle2, Circle } from 'lucide-react';

type Props = {
  activateUrl: string;
  storefrontUrl: string;
  buttonEnabled: boolean;
  paymentsConnected: boolean;
  showPaymentsStep: boolean;
  orderPlaced: boolean;
};

const ACTION_CLASS = 'shrink-0 px-3 py-1.5 text-sm font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors';

// Takes a new merchant from install to a first order without anyone's help.
export default function SetupChecklist({ activateUrl, storefrontUrl, buttonEnabled, paymentsConnected, showPaymentsStep, orderPlaced }: Props) {
  if (buttonEnabled && orderPlaced) return null;

  const steps = [
    {
      done: buttonEnabled,
      title: 'Turn on the checkout button',
      detail: 'Switch on CheckoutFlow in your theme and click Save. Then open a product page and try the button.',
      action: <a href={activateUrl} target="_blank" rel="noreferrer" className={ACTION_CLASS}>Turn on</a>,
    },
    ...(showPaymentsStep
      ? [{
          done: paymentsConnected,
          title: 'Connect online payments (optional)',
          detail: 'Add your Razorpay keys to accept UPI and cards. Without them, customers can still use Cash on Delivery.',
          action: <Link href="/settings" className={ACTION_CLASS}>Add keys</Link>,
        }]
      : []),
    {
      done: orderPlaced,
      title: 'Place a test order',
      detail: 'Buy something on your store with Cash on Delivery, then check that it appears in Shopify.',
      action: <a href={storefrontUrl} target="_blank" rel="noreferrer" className={ACTION_CLASS}>Open store</a>,
    },
  ];

  return (
    <section aria-labelledby="setup-title" className="mb-6 bg-white border border-slate-200 rounded-xl shadow-sm p-4 md:p-6">
      <h2 id="setup-title" className="text-lg font-bold tracking-tight text-slate-900">Finish setting up your checkout</h2>
      <ul className="mt-4 divide-y divide-slate-100">
        {steps.map((step) => (
          <li key={step.title} className="flex flex-wrap items-center gap-3 py-3">
            {step.done
              ? <CheckCircle2 size={20} className="text-emerald-600 shrink-0" aria-label="Done" />
              : <Circle size={20} className="text-slate-300 shrink-0" aria-label="Not done" />}
            <div className="flex-1 min-w-[200px]">
              <p className={`text-sm font-medium ${step.done ? 'text-slate-500' : 'text-slate-900'}`}>{step.title}</p>
              {!step.done && <p className="text-sm text-slate-500 mt-0.5">{step.detail}</p>}
            </div>
            {!step.done && step.action}
          </li>
        ))}
      </ul>
    </section>
  );
}
