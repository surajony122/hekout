import type { Discount, ShippingRule } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export const RULE_METHODS = ['COD', 'PREPAID', 'PARTIAL COD'];
export const DISCOUNT_TYPES = ['percentage', 'flat', 'slab', 'free_gift', 'free_shipping'];

export type Slab = { min: number; type: 'percentage' | 'flat'; value: number };
export type RuleCollection = { id: string; title: string };

// One cart line, with the collections its product belongs to when a rule needs them.
export type RuleCart = {
  lines: { variantId: string; quantity: number; lineTotal: number }[];
  collectionsByVariant: Map<string, string[]>;
};

export type PickedOffers = {
  money: { rule: Discount; amount: number }[];
  gifts: Discount[];
  freeShipping: boolean;
  ruleIds: string[];
  dropShopifyAutomatic: boolean;
};

const roundMoney = (value: number) => Math.round(value * 100) / 100;
const collectionsOf = (rule: Discount) => (Array.isArray(rule.collections) ? rule.collections as unknown as RuleCollection[] : []);
const slabsOf = (rule: Discount) => (Array.isArray(rule.slabs) ? rule.slabs as unknown as Slab[] : []);
const isMoneyRule = (rule: Discount) => ['percentage', 'flat', 'slab'].includes(rule.type);
const allowsMethod = (methods: string[], method: string) => methods.length === 0 || methods.includes(method);

export const needsCollections = (rules: Discount[]) => rules.some((rule) => collectionsOf(rule).length > 0);

const isLive = (rule: Discount, now: Date) =>
  rule.isActive &&
  (!rule.startsAt || rule.startsAt <= now) &&
  (!rule.endsAt || rule.endsAt > now) &&
  (rule.usageLimit === null || rule.usageCount < rule.usageLimit);

async function usedByCustomer(rules: Discount[], phone: string) {
  const limited = rules.filter((rule) => rule.perCustomerLimit !== null).map((rule) => rule.id);
  if (limited.length === 0) return new Map<string, number>();
  const used = await prisma.discountRedemption.groupBy({
    by: ['discountId'],
    where: { discountId: { in: limited }, phone },
    _count: true,
  });
  return new Map(used.map((row) => [row.discountId, row._count]));
}

// The rules this customer can use right now. Codes they can't use are kept apart, so
// they get a clear message and the code never goes to Shopify by mistake.
export async function loadCheckoutRules(merchantId: string, phone: string) {
  const [discounts, shippingRules] = await Promise.all([
    prisma.discount.findMany({ where: { merchantId, isActive: true } }),
    prisma.shippingRule.findMany({ where: { merchantId, isActive: true } }),
  ]);
  const now = new Date();
  const used = await usedByCustomer(discounts, phone);
  const canUse = (rule: Discount) =>
    isLive(rule, now) && (rule.perCustomerLimit === null || (used.get(rule.id) ?? 0) < rule.perCustomerLimit);

  return {
    discounts: discounts.filter(canUse),
    unusableCodes: new Set(discounts.filter((rule) => !rule.isAuto && !canUse(rule)).map((rule) => rule.code)),
    shippingRules,
  };
}

// A signed quote can be 10 minutes old, so its offers are checked again before an order.
export async function rulesStillValid(merchantId: string, ruleIds: string[], phone: string) {
  if (ruleIds.length === 0) return true;
  const { discounts } = await loadCheckoutRules(merchantId, phone);
  const usable = new Set(discounts.map((rule) => rule.id));
  return ruleIds.every((id) => usable.has(id));
}

function checkRule(rule: Discount, cart: RuleCart): { amount: number; reason?: string } {
  const collections = collectionsOf(rule).map((collection) => collection.id);
  const lines = collections.length === 0
    ? cart.lines
    : cart.lines.filter((line) => (cart.collectionsByVariant.get(line.variantId) ?? []).some((id) => collections.includes(id)));
  if (lines.length === 0) return { amount: 0, reason: "This code isn't valid for the items in your cart." };

  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const quantity = lines.reduce((sum, line) => sum + line.quantity, 0);
  if (subtotal < rule.minCartValue) {
    return { amount: 0, reason: `Add items worth ₹${Math.ceil(rule.minCartValue - subtotal).toLocaleString('en-IN')} more to use this code.` };
  }
  if (quantity < rule.minItems) {
    return { amount: 0, reason: `Add ${rule.minItems - quantity} more item${rule.minItems - quantity === 1 ? '' : 's'} to use this code.` };
  }

  let amount = 0;
  if (rule.type === 'percentage') amount = subtotal * (rule.value / 100);
  if (rule.type === 'flat') amount = rule.value;
  if (rule.type === 'slab') {
    const slab = slabsOf(rule).filter((option) => subtotal >= option.min).sort((a, b) => b.min - a.min)[0];
    if (!slab) return { amount: 0, reason: 'Your cart has not reached this offer yet.' };
    amount = slab.type === 'percentage' ? subtotal * (slab.value / 100) : slab.value;
  }
  if (rule.maxDiscount !== null) amount = Math.min(amount, rule.maxDiscount);
  return { amount: roundMoney(Math.min(amount, subtotal)) };
}

// Why the customer's code can't be used on this cart, if it can't.
export const codeProblem = (rule: Discount, cart: RuleCart) => checkRule(rule, cart).reason;

// Decides which offers apply. Rules allowed to combine add up, and any other rule stands alone.
// A code the customer typed always beats automatic offers it can't combine with.
export function pickOffers(rules: Discount[], cart: RuleCart, method: string, ownCode: Discount | null, shopifyDiscount: number): PickedOffers {
  const applying = rules
    .filter((rule) => (rule.isAuto || rule.id === ownCode?.id) && allowsMethod(rule.paymentMethods, method))
    .map((rule) => ({ rule, ...checkRule(rule, cart) }))
    .filter((option) => !option.reason);

  const gifts = applying.filter(({ rule }) => rule.type === 'free_gift').map(({ rule }) => rule);
  const freeShippingRules = applying.filter(({ rule }) => rule.type === 'free_shipping').map(({ rule }) => rule);
  const moneyOptions = applying.filter(({ rule }) => isMoneyRule(rule));

  const typed = moneyOptions.find(({ rule }) => rule.id === ownCode?.id);
  const others = moneyOptions.filter(({ rule }) => rule.id !== ownCode?.id);
  const combinable = others.filter(({ rule }) => rule.canCombine);
  const alone = others.filter(({ rule }) => !rule.canCombine);
  const total = (list: typeof moneyOptions) => list.reduce((sum, item) => sum + item.amount, 0);

  let money: typeof moneyOptions;
  let dropShopifyAutomatic = false;
  if (typed) {
    money = typed.rule.canCombine ? [typed, ...combinable] : [typed];
    dropShopifyAutomatic = !typed.rule.canCombine && shopifyDiscount > 0;
  } else {
    // Shopify's discount is already on the order, so only rules allowed to combine join it.
    const standAlone = shopifyDiscount > 0 ? [] : alone.sort((a, b) => b.amount - a.amount).slice(0, 1);
    money = total(standAlone) > total(combinable) ? standAlone : combinable;
  }

  return {
    money: money.map(({ rule, amount }) => ({ rule, amount })),
    gifts,
    freeShipping: freeShippingRules.length > 0,
    ruleIds: [...money.map(({ rule }) => rule.id), ...gifts.map((rule) => rule.id), ...freeShippingRules.map((rule) => rule.id)],
    dropShopifyAutomatic,
  };
}

const pincodeMatches = (pattern: string, pincode: string) =>
  pattern.endsWith('*') ? pincode.startsWith(pattern.slice(0, -1)) : pattern === pincode;

// The most specific matching rule wins: pincode, then state, then cart value alone.
// Among equals the customer gets the lowest fee. No match returns null.
export function matchShippingRule(rules: ShippingRule[], subtotal: number, method: string, state: string, pincode: string) {
  const score = (rule: ShippingRule) => (rule.pincodes.length > 0 ? 2 : rule.states.length > 0 ? 1 : 0);
  const stateName = state.trim().toLowerCase();
  const matches = rules.filter((rule) =>
    allowsMethod(rule.paymentMethods, method) &&
    subtotal >= rule.minCart &&
    (rule.maxCart === null || subtotal < rule.maxCart) &&
    (rule.states.length === 0 || rule.states.some((name) => name.toLowerCase() === stateName)) &&
    (rule.pincodes.length === 0 || (pincode !== '' && rule.pincodes.some((pattern) => pincodeMatches(pattern, pincode))))
  );
  return matches.sort((a, b) => score(b) - score(a) || a.fee - b.fee)[0] ?? null;
}

// Counts an order's offers once, however many times the order is retried.
export async function recordRedemptions(ruleIds: string[], orderId: string, phone: string) {
  for (const discountId of ruleIds) {
    const created = await prisma.discountRedemption.createMany({
      data: [{ discountId, orderId, phone }],
      skipDuplicates: true,
    });
    if (created.count > 0) {
      await prisma.discount.updateMany({ where: { id: discountId }, data: { usageCount: { increment: 1 } } });
    }
  }
}
