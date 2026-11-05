import { prisma } from '@/lib/prisma';

const SHOPIFY_API_VERSION = '2024-01';
const MAX_QUANTITY = 1000;

// An error whose message is safe to show to the customer.
export class CheckoutError extends Error {
  constructor(public status: number, message: string) {
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

type PriceCheckoutInput = {
  items: unknown;
  paymentMethod: unknown;
  couponCode: unknown;
  upsellVariantId: unknown;
};

const roundMoney = (value: number) => Math.round(value * 100) / 100;

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

async function fetchVariant(merchant: MerchantForPricing, variantId: string) {
  const res = await fetch(
    `https://${merchant.shopDomain}/admin/api/${SHOPIFY_API_VERSION}/variants/${variantId}.json`,
    { headers: { 'X-Shopify-Access-Token': merchant.accessToken } }
  );
  if (res.status === 404) {
    throw new CheckoutError(400, 'A product in your cart is no longer available.');
  }
  if (!res.ok) {
    throw new CheckoutError(502, 'Could not confirm product prices. Please try again.');
  }
  const { variant } = await res.json();
  const price = parseFloat(variant?.price);
  if (!Number.isFinite(price) || price < 0) {
    throw new CheckoutError(502, 'Could not confirm product prices. Please try again.');
  }
  return { price, title: typeof variant.title === 'string' ? variant.title : '' };
}

// The single source of truth for what an order costs. Every amount is derived
// from Shopify prices and the merchant's saved settings, never from the browser.
export async function priceCheckout(merchant: MerchantForPricing, input: PriceCheckoutInput) {
  const items = parseItems(input.items);
  const paymentMethod = typeof input.paymentMethod === 'string' && input.paymentMethod.trim()
    ? input.paymentMethod.trim().slice(0, 50)
    : 'COD';
  const isCod = isCodMethod(paymentMethod);

  const lineItems: { title: string; price: string; quantity: number; variant_id: number }[] = [];
  const titles: string[] = [];
  let subtotal = 0;
  let firstPrice = 0;

  for (const item of items) {
    const variant = await fetchVariant(merchant, item.variantId);
    const title = item.title || variant.title || 'Product';
    if (lineItems.length === 0) firstPrice = variant.price;
    subtotal += variant.price * item.quantity;
    titles.push(title);
    lineItems.push({
      title,
      price: variant.price.toString(),
      quantity: item.quantity,
      variant_id: Number(item.variantId),
    });
  }

  const quantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const discountTitles: string[] = [];
  // Coupons and free shipping are judged on the cart itself, as the widget shows them.
  const cartSubtotal = subtotal;

  let upsellDiscount = 0;
  let upsell: { id: string; revenue: number } | null = null;
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
      const variant = await fetchVariant(merchant, offerVariantId);
      const discount = funnel.discountType === 'percentage'
        ? variant.price * (funnel.discountValue / 100)
        : funnel.discountValue;
      upsellDiscount = Math.min(Math.max(0, discount), variant.price);
      subtotal += variant.price;
      titles.push(funnel.offerTitle);
      lineItems.push({
        title: funnel.offerTitle,
        price: variant.price.toString(),
        quantity: 1,
        variant_id: Number(offerVariantId),
      });
      upsell = { id: funnel.id, revenue: variant.price - upsellDiscount };
      if (upsellDiscount > 0) discountTitles.push('Upsell Offer');
    }
  }

  let couponDiscount = 0;
  if (input.couponCode) {
    const coupon = await prisma.discount.findFirst({
      where: { merchantId: merchant.id, code: String(input.couponCode), isActive: true },
    });
    if (!coupon || quantity < coupon.minItems || cartSubtotal < coupon.minCartValue) {
      throw new CheckoutError(400, 'This coupon is not valid for your cart.');
    }
    couponDiscount = coupon.type === 'percentage' ? cartSubtotal * (coupon.value / 100) : coupon.value;
    if (coupon.maxDiscount && couponDiscount > coupon.maxDiscount) couponDiscount = coupon.maxDiscount;
    couponDiscount = Math.min(Math.max(0, couponDiscount), subtotal - upsellDiscount);
    if (couponDiscount > 0) discountTitles.push(coupon.code);
  }

  const settings = merchant.paymentSettings;

  let prepaidDiscount = 0;
  if (!isCod && settings?.isPrepaidDiscountEnabled) {
    const remaining = Math.max(0, subtotal - upsellDiscount - couponDiscount);
    const discount = settings.prepaidDiscountType === 'percentage'
      ? remaining * (settings.prepaidDiscountValue / 100)
      : settings.prepaidDiscountValue;
    prepaidDiscount = Math.min(Math.max(0, discount), remaining);
    if (prepaidDiscount > 0) discountTitles.push('Prepaid Discount');
  }

  let shippingFee = 0;
  if (settings?.isShippingFeeEnabled) {
    const threshold = settings.freeShippingThreshold;
    if (threshold === 0 || cartSubtotal < threshold) {
      shippingFee = Math.max(0, settings.shippingFeeAmount);
    }
  }

  // Matches the widget: the COD fee defaults to on at ₹69, and is waived when shipping is charged.
  let codFee = 0;
  if (isCod && settings?.isCodFeeEnabled !== false && shippingFee === 0) {
    codFee = Math.max(0, settings?.codFeeAmount ?? 69);
  }

  const totalDiscount = roundMoney(upsellDiscount + couponDiscount + prepaidDiscount);

  return {
    lineItems,
    paymentMethod,
    isCod,
    quantity,
    firstPrice,
    firstVariantId: items[0].variantId,
    productTitle: titles.join(', ').slice(0, 200),
    discountTitles,
    prepaidDiscount: roundMoney(prepaidDiscount),
    totalDiscount,
    shippingFee: roundMoney(shippingFee),
    codFee: roundMoney(codFee),
    total: roundMoney(Math.max(0, subtotal - totalDiscount) + shippingFee + codFee),
    upsell,
  };
}
