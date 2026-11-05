export const CHECKOUT_PLANS = {
  OTP_ONLY: {
    name: 'OTP Verify',
    description: 'Customers verify their phone by OTP, then finish on Shopify checkout with their details filled in.',
    available: true,
    popupOrders: false,
    onlinePayments: false,
    feeEnv: 'PLAN_FEE_PERCENT_OTP_ONLY',
  },
  OTP_COD: {
    name: 'OTP + COD',
    description: 'Customers choose how to pay first. COD and Partial COD use OTP and the popup, and online payments go to Shopify checkout.',
    available: true,
    popupOrders: true,
    onlinePayments: false,
    feeEnv: 'PLAN_FEE_PERCENT_OTP_COD',
  },
  FULL: {
    name: 'Full Checkout',
    description: 'The complete popup checkout, with OTP, Cash on Delivery and online payments through your Razorpay account.',
    available: true,
    popupOrders: true,
    onlinePayments: true,
    feeEnv: 'PLAN_FEE_PERCENT_FULL',
  },
} as const;

export type CheckoutPlan = keyof typeof CHECKOUT_PLANS;

export const isCheckoutPlan = (value: unknown): value is CheckoutPlan =>
  typeof value === 'string' && Object.hasOwn(CHECKOUT_PLANS, value);

// An unrecognised stored value gets the least permissive plan that still works.
const planInfo = (plan: string) => (isCheckoutPlan(plan) ? CHECKOUT_PLANS[plan] : CHECKOUT_PLANS.OTP_COD);

export const planAllowsOnlinePayments = (plan: string) => planInfo(plan).onlinePayments;

// OTP Verify customers finish on Shopify checkout, so the popup never places their orders.
// Partial COD takes its part payment through the store's own Razorpay account.
export const planAllowsPartialCod = (plan: string) => plan === 'OTP_COD';

export const planAllowsPopupOrders = (plan: string) => planInfo(plan).popupOrders;

// Rates live in Render's environment settings, so they can change without a code release.
export function planFeePercent(plan: string): number {
  const percent = Number(process.env[planInfo(plan).feeEnv]);
  return Number.isFinite(percent) && percent >= 0 && percent <= 100 ? percent : 0;
}

export const calculateFee = (total: number, percent: number) => Math.round(total * percent) / 100;
