import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { safeEqual } from '@/lib/checkout-session';

const SHOPIFY_API_VERSION = '2026-07';
const MAX_QUANTITY = 1000;

// An error whose message is safe to show to the customer.
export class CheckoutError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

type PaymentConfig = {
  isPrepaidDiscountEnabled: boolean;
  prepaidDiscountType: string;
  prepaidDiscountValue: number;
  isCodFeeEnabled: boolean;
  codFeeAmount: number;
  isShippingFeeEnabled: boolean;
  shippingFeeAmount: number;
  freeShippingThreshold: number;
} | null;

type MerchantForPricing = {
  id: string;
  shopDomain: string;
  accessToken: string;
  paymentSettings: PaymentConfig;
};

export type CheckoutCustomer = {
  name?: unknown;
  email?: unknown;
  phone: string;
  address?: unknown;
  city?: unknown;
  state?: unknown;
  pincode?: unknown;
};

type PriceCheckoutInput = {
  items: unknown;
  couponCode: unknown;
  upsellVariantId: unknown;
  customer: CheckoutCustomer;
};

type Money = { shopMoney: { amount: string } };

type CalculatedDraftOrder = {
  currencyCode: string;
  discountCodes: string[];
  warnings: { errorCode: string; field: string; message: string }[];
  totalLineItemsPriceSet: Money;
  totalDiscountsSet: Money;
  totalShippingPriceSet: Money;
  totalTaxSet: Money;
  totalPriceSet: Money;
  lineItems: { originalUnitPriceSet: Money; discountedTotalSet: Money }[];
};

const CALCULATE_DRAFT_ORDER = `mutation CalculateDraftOrder($input: DraftOrderInput!) {
  draftOrderCalculate(input: $input) {
    calculatedDraftOrder {
      currencyCode
      discountCodes
      warnings { errorCode field message }
      totalLineItemsPriceSet { shopMoney { amount } }
      totalDiscountsSet { shopMoney { amount } }
      totalShippingPriceSet { shopMoney { amount } }
      totalTaxSet { shopMoney { amount } }
      totalPriceSet { shopMoney { amount } }
      lineItems {
        originalUnitPriceSet { shopMoney { amount } }
        discountedTotalSet { shopMoney { amount } }
      }
    }
    userErrors { field message }
  }
}`;

const CREATE_DRAFT_ORDER = `mutation CreateDraftOrder($input: DraftOrderInput!) {
  draftOrderCreate(input: $input) {
    draftOrder {
      id
      legacyResourceId
      totalPriceSet { shopMoney { amount } }
    }
    userErrors { field message }
  }
}`;

const FIND_CUSTOMER = `query FindCustomer($query: String!) {
  customers(first: 1, query: $query) {
    nodes { id }
  }
}`;

const roundMoney = (value: number) => Math.round(value * 100) / 100;
const amountOf = (money: Money) => parseFloat(money.shopMoney.amount);
const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);

export const isCodMethod = (method: string) => method.toUpperCase() === 'COD';

function parseItems(items: unknown) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new CheckoutError(400, 'Your cart is empty.');
  }
  return items.map((item) => {
    const variantId = String(item?.variantId ?? '');
    const quantity = Number(item?.quantity);
    if (!/^\d+$/.test(variantId)) {
      throw new CheckoutError(400, 'Invalid product in cart.');
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
      throw new CheckoutError(400, 'Invalid quantity in cart.');
    }
    const title = typeof item?.title === 'string' ? item.title.slice(0, 200) : '';
    return { variantId, quantity, title };
  });
}

async function shopifyGraphql(merchant: MerchantForPricing, query: string, variables: unknown) {
  const res = await fetch(`https://${merchant.shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': merchant.accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body || body.errors) {
    console.error('Shopify API Error:', res.status, JSON.stringify(body?.errors ?? body));
    throw new CheckoutError(502, 'Could not confirm your order total. Please try again.');
  }
  return body.data;
}

async function calculateDraftOrder(merchant: MerchantForPricing, input: unknown): Promise<CalculatedDraftOrder> {
  const data = await shopifyGraphql(merchant, CALCULATE_DRAFT_ORDER, { input });
  const { calculatedDraftOrder, userErrors } = data.draftOrderCalculate;
  if (userErrors.length > 0 || !calculatedDraftOrder) {
    console.error('Shopify Pricing Error:', JSON.stringify(userErrors));
    throw new CheckoutError(400, 'Could not price your cart. A product may no longer be available.');
  }
  return calculatedDraftOrder;
}

function buildAddress(customer: CheckoutCustomer) {
  if (!text(customer.address)) return undefined;
  const [firstName, ...rest] = (text(customer.name) ?? '').split(/\s+/);
  return {
    firstName: firstName || undefined,
    lastName: rest.join(' ') || undefined,
    address1: text(customer.address),
    city: text(customer.city),
    province: text(customer.state),
    zip: text(customer.pincode),
    country: 'India',
    phone: formatPhone(customer.phone),
  };
}

// Shopify needs a country code. 10-digit numbers default to India.
function formatPhone(phone: string) {
  return phone.length === 10 ? `+91${phone}` : `+${phone}`;
}

// Codes limited to specific customers only apply when the order is linked to that
// customer. The phone is verified by OTP, so it is safe to use for this. If the lookup
// fails, checkout carries on as a guest and those codes are simply rejected.
async function findCustomerId(merchant: MerchantForPricing, phone: string): Promise<string | null> {
  try {
    const data = await shopifyGraphql(merchant, FIND_CUSTOMER, { query: `phone:${formatPhone(phone)}` });
    return data.customers.nodes[0]?.id ?? null;
  } catch {
    return null;
  }
}

async function buildBaseInput(merchant: MerchantForPricing, input: PriceCheckoutInput) {
  const items = parseItems(input.items);
  const titles = items.map((item) => item.title || 'Product');
  const lineItems: Record<string, unknown>[] = items.map((item) => ({
    variantId: `gid://shopify/ProductVariant/${item.variantId}`,
    quantity: item.quantity,
  }));

  let upsellId: string | null = null;
  if (input.upsellVariantId) {
    const offerVariantId = String(input.upsellVariantId);
    if (!/^\d+$/.test(offerVariantId)) throw new CheckoutError(400, 'Invalid upsell offer.');

    const funnel = await prisma.upsellFunnel.findFirst({
      where: {
        merchantId: merchant.id,
        offerVariantId,
        isActive: true,
        OR: [{ triggerVariantId: null }, { triggerVariantId: { in: items.map((i) => i.variantId) } }],
      },
    });
    if (funnel) {
      upsellId = funnel.id;
      titles.push(funnel.offerTitle);
      lineItems.push({
        variantId: `gid://shopify/ProductVariant/${offerVariantId}`,
        quantity: 1,
        ...(funnel.discountValue > 0
          ? {
              appliedDiscount: {
                title: 'Upsell Offer',
                value: funnel.discountValue,
                valueType: funnel.discountType === 'percentage' ? 'PERCENTAGE' : 'FIXED_AMOUNT',
              },
            }
          : {}),
      });
    }
  }

  const couponCode = text(input.couponCode);
  const customerId = await findCustomerId(merchant, input.customer.phone);

  return {
    items,
    titles,
    upsellId,
    couponCode,
    draftInput: {
      lineItems,
      discountCodes: couponCode ? [couponCode] : [],
      acceptAutomaticDiscounts: true,
      phone: formatPhone(input.customer.phone),
      email: text(input.customer.email),
      shippingAddress: buildAddress(input.customer),
      ...(customerId ? { purchasingEntity: { customerId } } : {}),
    },
  };
}

const isCouponApplied = (couponCode: string, calculated: CalculatedDraftOrder) =>
  calculated.discountCodes.some((code) => code.toUpperCase() === couponCode.toUpperCase());

// Shopify drops a code it does not recognise without any warning, so the code
// must be in its applied list. When it explains the rejection, show that reason.
function assertCouponApplied(couponCode: string | undefined, calculated: CalculatedDraftOrder) {
  if (!couponCode || isCouponApplied(couponCode, calculated)) return;
  const reason = calculated.warnings.find((warning) => warning.field === 'discountCodes');
  throw new CheckoutError(400, reason?.message || 'This coupon is not valid for your cart.', 'INVALID_COUPON');
}

// Adds the store's payment-method fees and discounts, then asks Shopify for the final total.
async function priceForMethod(
  merchant: MerchantForPricing,
  base: Awaited<ReturnType<typeof buildBaseInput>>,
  calculated: CalculatedDraftOrder,
  paymentMethod: string
) {
  const isCod = isCodMethod(paymentMethod);
  const settings = merchant.paymentSettings;
  const cartSubtotal = amountOf(calculated.totalLineItemsPriceSet);
  const remaining = Math.max(0, cartSubtotal - amountOf(calculated.totalDiscountsSet));

  let prepaidDiscount = 0;
  if (!isCod && settings?.isPrepaidDiscountEnabled) {
    const discount = settings.prepaidDiscountType === 'percentage'
      ? remaining * (settings.prepaidDiscountValue / 100)
      : settings.prepaidDiscountValue;
    prepaidDiscount = roundMoney(Math.min(Math.max(0, discount), remaining));
  }

  let shippingFee = 0;
  if (settings?.isShippingFeeEnabled) {
    const threshold = settings.freeShippingThreshold;
    if (threshold === 0 || cartSubtotal < threshold) {
      shippingFee = roundMoney(Math.max(0, settings.shippingFeeAmount));
    }
  }

  // Matches the widget: the COD fee defaults to on at ₹69, and is waived when shipping is charged.
  let codFee = 0;
  if (isCod && settings?.isCodFeeEnabled !== false && shippingFee === 0) {
    codFee = roundMoney(Math.max(0, settings?.codFeeAmount ?? 69));
  }

  const shippingLine = (title: string, amount: number) => ({
    title,
    priceWithCurrency: { amount, currencyCode: calculated.currencyCode },
  });
  const inputWithFees = {
    ...base.draftInput,
    ...(shippingFee > 0 ? { shippingLine: shippingLine('Shipping Fee', shippingFee) } : {}),
    ...(codFee > 0 ? { shippingLine: shippingLine('Cash on Delivery Fee', codFee) } : {}),
  };
  let draftInput: typeof inputWithFees & { appliedDiscount?: unknown } = prepaidDiscount > 0
    ? { ...inputWithFees, appliedDiscount: { title: 'Prepaid Discount', value: prepaidDiscount, valueType: 'FIXED_AMOUNT' } }
    : inputWithFees;

  let final = prepaidDiscount > 0 || shippingFee > 0 || codFee > 0
    ? await calculateDraftOrder(merchant, draftInput)
    : calculated;

  // If Shopify won't combine the customer's code with the prepaid discount, the code wins.
  if (prepaidDiscount > 0 && base.couponCode && !isCouponApplied(base.couponCode, final)) {
    prepaidDiscount = 0;
    draftInput = inputWithFees;
    final = shippingFee > 0 ? await calculateDraftOrder(merchant, draftInput) : calculated;
  }
  assertCouponApplied(base.couponCode, final);

  const totalDiscount = amountOf(final.totalDiscountsSet);

  return {
    paymentMethod,
    isCod,
    draftInput,
    currency: final.currencyCode,
    quantity: base.items.reduce((sum, item) => sum + item.quantity, 0),
    firstPrice: amountOf(final.lineItems[0].originalUnitPriceSet),
    firstVariantId: base.items[0].variantId,
    productTitle: base.titles.join(', ').slice(0, 200),
    subtotal: amountOf(final.totalLineItemsPriceSet),
    discount: roundMoney(Math.max(0, totalDiscount - prepaidDiscount)),
    prepaidDiscount,
    shippingFee,
    codFee,
    tax: amountOf(final.totalTaxSet),
    total: amountOf(final.totalPriceSet),
    upsell: base.upsellId
      ? { id: base.upsellId, revenue: amountOf(final.lineItems[final.lineItems.length - 1].discountedTotalSet) }
      : null,
  };
}

// The single source of truth for what an order costs. Shopify works out the
// prices, discount codes, automatic discounts and tax, never the browser.
export async function priceCheckout(
  merchant: MerchantForPricing,
  input: PriceCheckoutInput & { paymentMethod: unknown }
) {
  const paymentMethod = text(input.paymentMethod)?.slice(0, 50) ?? 'COD';
  const base = await buildBaseInput(merchant, input);
  const calculated = await calculateDraftOrder(merchant, base.draftInput);
  assertCouponApplied(base.couponCode, calculated);
  return priceForMethod(merchant, base, calculated, paymentMethod);
}

// Totals for both ways of paying, for the widget to show before the customer chooses.
export async function quoteCheckout(merchant: MerchantForPricing, input: PriceCheckoutInput) {
  const base = await buildBaseInput(merchant, input);
  const calculated = await calculateDraftOrder(merchant, base.draftInput);
  assertCouponApplied(base.couponCode, calculated);
  const [cod, prepaid] = await Promise.all([
    priceForMethod(merchant, base, calculated, 'COD'),
    priceForMethod(merchant, base, calculated, 'PREPAID'),
  ]);
  return { cod, prepaid };
}

type Pricing = Awaited<ReturnType<typeof priceForMethod>>;

const QUOTE_TTL_MS = 10 * 60 * 1000;

function signQuote(payload: string): string {
  const secret = process.env.SHOPIFY_CLIENT_SECRET;
  if (!secret) throw new Error('SHOPIFY_CLIENT_SECRET is not set');
  const key = crypto.createHmac('sha256', secret).update('checkout-quote-v1').digest();
  return crypto.createHmac('sha256', key).update(payload).digest('base64url');
}

// A tamper-proof copy of the pricing the customer was shown, so placing the order
// doesn't have to ask Shopify for it all over again.
export function createQuoteToken(pricing: Pricing, shop: string, phone: string): string {
  const payload = Buffer.from(
    JSON.stringify({ shop, phone, exp: Date.now() + QUOTE_TTL_MS, pricing })
  ).toString('base64url');
  return `${payload}.${signQuote(payload)}`;
}

function readQuoteToken(token: unknown, shop: string, phone: string): Pricing | null {
  if (typeof token !== 'string') return null;
  const [payload, signature, ...rest] = token.split('.');
  if (!payload || !signature || rest.length > 0 || !safeEqual(signQuote(payload), signature)) return null;
  try {
    const quote = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return quote.shop === shop && quote.phone === phone && quote.exp > Date.now() ? quote.pricing : null;
  } catch {
    return null;
  }
}

// Uses the signed quote when it matches this customer and way of paying. Otherwise
// (expired, changed or missing) it prices the order from scratch.
export async function resolvePricing(
  merchant: MerchantForPricing,
  input: PriceCheckoutInput & { paymentMethod: unknown; quoteToken: unknown }
) {
  const quoted = input.upsellVariantId ? null : readQuoteToken(input.quoteToken, merchant.shopDomain, input.customer.phone);
  const paymentMethod = text(input.paymentMethod)?.slice(0, 50) ?? 'COD';
  if (quoted && quoted.isCod === isCodMethod(paymentMethod)) {
    return { pricing: { ...quoted, paymentMethod }, fromQuote: true };
  }
  return { pricing: await priceCheckout(merchant, input), fromQuote: false };
}

// Stops an order if the total changed after the customer saw it.
export function assertExpectedTotal(total: number, expectedTotal: unknown) {
  if (expectedTotal === undefined || expectedTotal === null) return;
  if (Math.abs(total - Number(expectedTotal)) >= 0.01) {
    throw new CheckoutError(409, 'Your order total has changed. Please review it and try again.', 'TOTAL_CHANGED');
  }
}

export async function createDraftOrder(merchant: MerchantForPricing, input: unknown) {
  const data = await shopifyGraphql(merchant, CREATE_DRAFT_ORDER, { input });
  const { draftOrder, userErrors } = data.draftOrderCreate;
  if (userErrors.length > 0 || !draftOrder) {
    console.error('Shopify Draft Order Error:', JSON.stringify(userErrors));
    return null;
  }
  return {
    legacyId: String(draftOrder.legacyResourceId),
    total: amountOf(draftOrder.totalPriceSet),
  };
}
