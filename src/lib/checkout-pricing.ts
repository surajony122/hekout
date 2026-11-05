import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { safeEqual } from '@/lib/checkout-session';
import { codeProblem, loadCheckoutRules, matchShippingRule, needsProductDetails, pickOffers, rulesStillValid } from '@/lib/checkout-rules';

const SHOPIFY_API_VERSION = '2026-07';
const MAX_QUANTITY = 1000;

// An error whose message is safe to show to the customer.
export class CheckoutError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

type PaymentConfig = {
  isPartialCodEnabled: boolean;
  partialCodAmount: number;
  partialCodType?: string;
  isPartialDiscountEnabled?: boolean;
  partialDiscountType?: string;
  partialDiscountValue?: number;
  partialFreeShipping?: boolean;
  prepaidFreeShipping?: boolean;
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

const VARIANT_DETAILS = `query VariantDetails($ids: [ID!]!) {
  nodes(ids: $ids) {
    ... on ProductVariant { id product { tags collections(first: 50) { nodes { id } } } }
  }
}`;

const CUSTOMER_CACHE_MS = 5 * 60 * 1000;
const CUSTOMER_CACHE_LIMIT = 5000;
const customerCache = new Map<string, { id: string | null; expires: number }>();

const roundMoney = (value: number) => Math.round(value * 100) / 100;
const amountOf = (money: Money) => parseFloat(money.shopMoney.amount);
const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);

export const isCodMethod = (method: string) => method.toUpperCase() === 'COD';
export const isPartialCodMethod = (method: string) => method.toUpperCase() === 'PARTIAL COD';

export function parseItems(items: unknown) {
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
  const key = `${merchant.shopDomain}|${phone}`;
  const cached = customerCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.id;

  try {
    const data = await shopifyGraphql(merchant, FIND_CUSTOMER, { query: `phone:${formatPhone(phone)}` });
    const id: string | null = data.customers.nodes[0]?.id ?? null;
    if (customerCache.size >= CUSTOMER_CACHE_LIMIT) customerCache.clear();
    customerCache.set(key, { id, expires: Date.now() + CUSTOMER_CACHE_MS });
    return id;
  } catch {
    return null;
  }
}

// Looks the customer up as soon as they verify, so their total doesn't wait for it.
export function warmCustomerLookup(merchant: { shopDomain: string; accessToken: string }, phone: string) {
  findCustomerId({ ...merchant, id: '', paymentSettings: null }, phone).catch(() => {});
}

// Only asked for when a rule is limited to collections or tags. If Shopify can't answer, those rules just don't apply.
async function productDetailsOfVariants(merchant: MerchantForPricing, variantIds: string[]) {
  const collectionsByVariant = new Map<string, string[]>();
  const tagsByVariant = new Map<string, string[]>();
  try {
    const data = await shopifyGraphql(merchant, VARIANT_DETAILS, { ids: variantIds.map((id) => `gid://shopify/ProductVariant/${id}`) });
    for (const node of data.nodes) {
      if (!node?.id) continue;
      const variantId = node.id.split('/').pop();
      collectionsByVariant.set(variantId, node.product.collections.nodes.map((collection: { id: string }) => collection.id));
      tagsByVariant.set(variantId, node.product.tags);
    }
  } catch (error) {
    console.error('Variant Details Error:', error);
  }
  return { collectionsByVariant, tagsByVariant };
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

  const typedCode = text(input.couponCode);
  const [customerId, rules] = await Promise.all([
    findCustomerId(merchant, input.customer.phone),
    loadCheckoutRules(merchant.id, input.customer.phone),
  ]);

  // Our own codes are handled here, and anything else is left for Shopify to check.
  const upperCode = typedCode?.toUpperCase();
  if (upperCode && rules.unusableCodes.has(upperCode)) {
    throw new CheckoutError(400, 'This coupon is no longer available.', 'INVALID_COUPON');
  }
  const ownCode = upperCode ? rules.discounts.find((rule) => !rule.isAuto && rule.code === upperCode) ?? null : null;
  const couponCode = ownCode ? undefined : typedCode;
  const productDetails = needsProductDetails(rules.discounts)
    ? await productDetailsOfVariants(merchant, items.map((item) => item.variantId))
    : { collectionsByVariant: new Map<string, string[]>(), tagsByVariant: new Map<string, string[]>() };

  return {
    items,
    titles,
    upsellId,
    couponCode,
    ownCode,
    discountRules: rules.discounts,
    shippingRules: rules.shippingRules,
    ...productDetails,
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
const ruleCart = (base: Awaited<ReturnType<typeof buildBaseInput>>, calculated: CalculatedDraftOrder) => ({
  lines: base.items.map((item, index) => ({
    variantId: item.variantId,
    quantity: item.quantity,
    lineTotal: amountOf(calculated.lineItems[index].originalUnitPriceSet) * item.quantity,
  })),
  collectionsByVariant: base.collectionsByVariant,
  tagsByVariant: base.tagsByVariant,
});

function assertOwnCodeUsable(base: Awaited<ReturnType<typeof buildBaseInput>>, calculated: CalculatedDraftOrder) {
  if (!base.ownCode) return;
  const problem = codeProblem(base.ownCode, ruleCart(base, calculated));
  if (problem) throw new CheckoutError(400, problem, 'INVALID_COUPON');
}

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
  paymentMethod: string,
  alreadyHasFees = false
) {
  const isCod = isCodMethod(paymentMethod);
  const isPartial = isPartialCodMethod(paymentMethod);
  const settings = merchant.paymentSettings;
  const method = isCod ? 'COD' : isPartial ? 'PARTIAL COD' : 'PREPAID';
  const cartSubtotal = amountOf(calculated.totalLineItemsPriceSet);
  const shopifyDiscount = amountOf(calculated.totalDiscountsSet);

  const offers = pickOffers(base.discountRules, ruleCart(base, calculated), method, base.ownCode, shopifyDiscount);
  const cartValue = Math.max(0, cartSubtotal - (offers.dropShopifyAutomatic ? 0 : shopifyDiscount));
  let offerDiscount = roundMoney(Math.min(offers.money.reduce((sum, offer) => sum + offer.amount, 0), cartValue));
  const remaining = cartValue - offerDiscount;

  // Prepaid and Partial COD each have their own discount, which the store owner chooses.
  const methodDiscountRule = !isCod && !isPartial && settings?.isPrepaidDiscountEnabled
    ? { type: settings.prepaidDiscountType, value: settings.prepaidDiscountValue, title: 'Prepaid Discount' }
    : isPartial && settings?.isPartialDiscountEnabled
      ? { type: settings.partialDiscountType ?? 'percentage', value: settings.partialDiscountValue ?? 0, title: 'Partial COD Discount' }
      : null;
  let prepaidDiscount = 0;
  if (methodDiscountRule) {
    const discount = methodDiscountRule.type === 'percentage'
      ? remaining * (methodDiscountRule.value / 100)
      : methodDiscountRule.value;
    prepaidDiscount = roundMoney(Math.min(Math.max(0, discount), remaining));
  }

  const freeShipping = offers.freeShipping ||
    (!isCod && !isPartial && settings?.prepaidFreeShipping) ||
    (isPartial && settings?.partialFreeShipping);
  const customer = base.draftInput.shippingAddress;
  const shippingRule = matchShippingRule(base.shippingRules, cartSubtotal, method, customer?.province ?? '', customer?.zip ?? '');

  let shippingFee = 0;
  if (freeShipping) {
    shippingFee = 0;
  } else if (shippingRule) {
    shippingFee = roundMoney(Math.max(0, shippingRule.fee));
  } else if (settings?.isShippingFeeEnabled) {
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
  // Gifts go before any upsell line, which is expected to stay last.
  const withGifts = (gifts: typeof offers.gifts) => {
    if (gifts.length === 0) return base.draftInput.lineItems;
    const lines = [...base.draftInput.lineItems];
    lines.splice(base.items.length, 0, ...gifts.map((gift) => ({
      variantId: `gid://shopify/ProductVariant/${gift.giftVariantId}`,
      quantity: gift.giftQuantity,
      appliedDiscount: { title: 'Free Gift', value: 100, valueType: 'PERCENTAGE' },
    })));
    return lines;
  };
  const buildInput = (gifts: typeof offers.gifts, withDiscounts: boolean) => {
    const offerAmount = withDiscounts ? offerDiscount : 0;
    const methodAmount = withDiscounts ? prepaidDiscount : 0;
    const title = [...(offerAmount > 0 ? offers.money.map((offer) => offer.rule.title) : []), ...(methodAmount > 0 && methodDiscountRule ? [methodDiscountRule.title] : [])].join(' + ');
    return {
      ...base.draftInput,
      lineItems: withGifts(gifts),
      ...(offers.dropShopifyAutomatic ? { acceptAutomaticDiscounts: false } : {}),
      ...(shippingFee > 0 ? { shippingLine: shippingLine('Shipping Fee', shippingFee) } : {}),
      ...(codFee > 0 ? { shippingLine: shippingLine('Cash on Delivery Fee', codFee) } : {}),
      ...(offerAmount + methodAmount > 0
        ? { appliedDiscount: { title: title.slice(0, 200), value: roundMoney(offerAmount + methodAmount), valueType: 'FIXED_AMOUNT' } }
        : {}),
    };
  };

  let gifts = offers.gifts;
  let draftInput = buildInput(gifts, true);
  const needsNewTotal = () => prepaidDiscount > 0 || offerDiscount > 0 || gifts.length > 0 || shippingFee > 0 || codFee > 0 || offers.dropShopifyAutomatic;

  let final = calculated;
  if (!alreadyHasFees && needsNewTotal()) {
    try {
      final = await calculateDraftOrder(merchant, draftInput);
    } catch (error) {
      // A gift that's out of stock shouldn't stop the customer buying.
      if (gifts.length === 0 || !(error instanceof CheckoutError) || error.status !== 400) throw error;
      console.error('Free gift could not be added:', gifts.map((gift) => gift.giftVariantId).join(','));
      gifts = [];
      draftInput = buildInput(gifts, true);
      final = needsNewTotal() ? await calculateDraftOrder(merchant, draftInput) : calculated;
    }
  }

  // If Shopify won't combine the customer's code with our discounts, the code wins.
  if (prepaidDiscount + offerDiscount > 0 && base.couponCode && !isCouponApplied(base.couponCode, final)) {
    prepaidDiscount = 0;
    offerDiscount = 0;
    draftInput = buildInput(gifts, false);
    final = shippingFee > 0 || gifts.length > 0 ? await calculateDraftOrder(merchant, draftInput) : calculated;
  }
  assertCouponApplied(base.couponCode, final);

  const totalDiscount = amountOf(final.totalDiscountsSet);
  const orderTotal = amountOf(final.totalPriceSet);
  const partialDue = settings?.partialCodType === 'percentage'
    ? roundMoney(orderTotal * (Math.max(0, settings.partialCodAmount ?? 0) / 100))
    : Math.max(0, settings?.partialCodAmount ?? 0);
  // Only offers that really reached the order count towards their limits.
  const droppedGifts = offers.gifts.filter((gift) => !gifts.includes(gift)).map((gift) => gift.id);
  const droppedMoney = offerDiscount > 0 ? [] : offers.money.map((offer) => offer.rule.id);
  const usedRuleIds = offers.ruleIds.filter((id) => !droppedGifts.includes(id) && !droppedMoney.includes(id));

  return {
    paymentMethod,
    isCod,
    isPartial,
    // What the customer pays online now. COD pays nothing now, and prepaid pays it all.
    amountDueNow: isCod ? 0 : isPartial ? Math.min(partialDue, orderTotal) : orderTotal,
    draftInput,
    currency: final.currencyCode,
    quantity: base.items.reduce((sum, item) => sum + item.quantity, 0),
    firstPrice: amountOf(final.lineItems[0].originalUnitPriceSet),
    firstVariantId: base.items[0].variantId,
    productTitle: [...base.titles, ...gifts.map((gift) => `Free: ${gift.giftTitle ?? 'Gift'}`)].join(', ').slice(0, 200),
    subtotal: amountOf(final.totalLineItemsPriceSet),
    discount: roundMoney(Math.max(0, totalDiscount - prepaidDiscount)),
    prepaidDiscount,
    shippingFee,
    codFee,
    tax: amountOf(final.totalTaxSet),
    total: orderTotal,
    ruleIds: usedRuleIds,
    gifts: gifts.map((gift) => ({ title: gift.giftTitle ?? 'Free gift', quantity: gift.giftQuantity })),
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
  assertOwnCodeUsable(base, calculated);
  return priceForMethod(merchant, base, calculated, paymentMethod);
}

// Totals for the ways of paying the customer can still choose. When they've already
// picked one, only that is priced, which needs far fewer calls to Shopify.
export async function quoteCheckout(merchant: MerchantForPricing, input: PriceCheckoutInput, methods?: string[]) {
  const wants = (method: string) => !methods || methods.includes(method);
  const settings = merchant.paymentSettings;
  const base = await buildBaseInput(merchant, input);

  // The COD fee is known in advance when no shipping rule applies, so one calculation is enough.
  const hasRules = base.discountRules.length > 0 || base.shippingRules.length > 0;
  if (methods?.length === 1 && methods[0] === 'COD' && !settings?.isShippingFeeEnabled && !hasRules) {
    const codFee = settings?.isCodFeeEnabled !== false ? roundMoney(Math.max(0, settings?.codFeeAmount ?? 69)) : 0;
    const calculated = await calculateDraftOrder(merchant, codFee > 0
      ? { ...base.draftInput, shippingLine: { title: 'Cash on Delivery Fee', priceWithCurrency: { amount: codFee, currencyCode: 'INR' } } }
      : base.draftInput);
    assertCouponApplied(base.couponCode, calculated);
    return { cod: await priceForMethod(merchant, base, calculated, 'COD', true), prepaid: null, partial: null };
  }

  const calculated = await calculateDraftOrder(merchant, base.draftInput);
  assertCouponApplied(base.couponCode, calculated);
  assertOwnCodeUsable(base, calculated);
  const partialEnabled = settings?.isPartialCodEnabled && (settings.partialCodAmount ?? 0) > 0;
  const [cod, prepaid, partial] = await Promise.all([
    wants('COD') ? priceForMethod(merchant, base, calculated, 'COD') : null,
    wants('PREPAID') ? priceForMethod(merchant, base, calculated, 'PREPAID') : null,
    wants('PARTIAL COD') && partialEnabled ? priceForMethod(merchant, base, calculated, 'PARTIAL COD') : null,
  ]);
  // A code limited to other ways of paying shouldn't look as if it worked.
  const ownCodeId = base.ownCode?.id;
  if (ownCodeId && ![cod, prepaid, partial].some((quote) => quote?.ruleIds.includes(ownCodeId))) {
    throw new CheckoutError(400, "This code isn't valid for this way of paying.", 'INVALID_COUPON');
  }
  return { cod, prepaid, partial };
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
  const offersStillGood = quoted ? await rulesStillValid(merchant.id, quoted.ruleIds ?? [], input.customer.phone) : false;
  if (quoted && offersStillGood && quoted.isCod === isCodMethod(paymentMethod) && quoted.isPartial === isPartialCodMethod(paymentMethod)) {
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
