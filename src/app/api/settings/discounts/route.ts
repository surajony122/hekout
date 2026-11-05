import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getLoggedInMerchant, unauthorized } from '@/lib/merchant-auth';
import { DISCOUNT_TYPES, RULE_METHODS } from '@/lib/checkout-rules';

class InvalidRule extends Error {}

const positive = (value: unknown, label: string) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new InvalidRule(`${label} must be more than 0.`);
  return number;
};
const atLeastZero = (value: unknown, label: string) => {
  if (value === '' || value === null || value === undefined) return 0;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new InvalidRule(`${label} can't be negative.`);
  return number;
};
const optionalWhole = (value: unknown, label: string) => {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw new InvalidRule(`${label} must be a whole number of 1 or more.`);
  return number;
};
// Dates are picked in Indian time. An end date lasts until that day is over.
const dateOf = (value: unknown, endOfDay: boolean) => {
  if (!value) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new InvalidRule('Please choose a valid date.');
  const date = new Date(`${value}T${endOfDay ? '23:59:59' : '00:00:00'}+05:30`);
  if (Number.isNaN(date.getTime())) throw new InvalidRule('Please choose a valid date.');
  return date;
};

function ruleFromBody(body: Record<string, unknown>) {
  const type = String(body.type);
  if (!DISCOUNT_TYPES.includes(type)) throw new InvalidRule('Please choose a discount type.');

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title || title.length > 80) throw new InvalidRule('Please give the discount a name of up to 80 characters.');

  const isAuto = Boolean(body.isAuto);
  const code = isAuto ? '' : String(body.code ?? '').trim().toUpperCase();
  if (!isAuto && !/^[A-Z0-9_-]{3,30}$/.test(code)) {
    throw new InvalidRule('A code needs 3 to 30 letters, numbers, dashes or underscores.');
  }

  let value = 0;
  if (type === 'percentage') {
    value = positive(body.value, 'The discount');
    if (value > 100) throw new InvalidRule("A percentage discount can't be more than 100.");
  }
  if (type === 'flat') value = positive(body.value, 'The discount');

  let slabs: Prisma.InputJsonValue | typeof Prisma.DbNull = Prisma.DbNull;
  if (type === 'slab') {
    if (!Array.isArray(body.slabs) || body.slabs.length === 0 || body.slabs.length > 10) throw new InvalidRule('Add between 1 and 10 slabs.');
    const parsed = body.slabs.map((slab) => {
      const slabType = slab?.type === 'flat' ? 'flat' : 'percentage';
      const slabValue = positive(slab?.value, 'Each slab discount');
      if (slabType === 'percentage' && slabValue > 100) throw new InvalidRule("A percentage slab can't be more than 100.");
      return { min: positive(slab?.min, 'Each slab cart value'), type: slabType, value: slabValue };
    });
    if (new Set(parsed.map((slab) => slab.min)).size !== parsed.length) throw new InvalidRule('Each slab needs a different cart value.');
    slabs = parsed.sort((a, b) => a.min - b.min);
  }

  let giftVariantId: string | null = null;
  let giftTitle: string | null = null;
  let giftQuantity = 1;
  if (type === 'free_gift') {
    giftVariantId = String(body.giftVariantId ?? '').split('/').pop() ?? '';
    if (!/^\d+$/.test(giftVariantId)) throw new InvalidRule('Please choose the free gift product.');
    giftTitle = typeof body.giftTitle === 'string' ? body.giftTitle.slice(0, 200) : 'Free gift';
    giftQuantity = optionalWhole(body.giftQuantity, 'Gift quantity') ?? 1;
    if (giftQuantity > 10) throw new InvalidRule('Gift quantity can be up to 10.');
  }

  const collections = Array.isArray(body.collections)
    ? body.collections.map((collection) => {
        const id = String(collection?.id ?? '');
        if (!/^gid:\/\/shopify\/Collection\/\d+$/.test(id)) throw new InvalidRule('Please choose a valid collection.');
        return { id, title: String(collection?.title ?? '').slice(0, 200) };
      })
    : [];
  if (collections.length > 20) throw new InvalidRule('A discount can use up to 20 collections.');

  const paymentMethods = Array.isArray(body.paymentMethods) ? body.paymentMethods.map(String) : [];
  if (paymentMethods.some((method) => !RULE_METHODS.includes(method))) throw new InvalidRule('Please choose valid payment methods.');

  const startsAt = dateOf(body.startsAt, false);
  const endsAt = dateOf(body.endsAt, true);
  if (startsAt && endsAt && endsAt <= startsAt) throw new InvalidRule('The end date must be after the start date.');

  const maxDiscount = body.maxDiscount === '' || body.maxDiscount === null || body.maxDiscount === undefined
    ? null
    : positive(body.maxDiscount, 'The maximum discount');

  return {
    code,
    title,
    description: typeof body.description === 'string' ? body.description.trim().slice(0, 200) : null,
    type,
    value,
    isAuto,
    canCombine: Boolean(body.canCombine),
    minItems: Math.floor(atLeastZero(body.minItems, 'Minimum items')),
    minCartValue: atLeastZero(body.minCartValue, 'Minimum cart value'),
    maxDiscount,
    isActive: body.isActive !== false,
    slabs,
    giftVariantId,
    giftTitle,
    giftQuantity,
    collections: collections.length > 0 ? collections : Prisma.DbNull,
    paymentMethods,
    usageLimit: optionalWhole(body.usageLimit, 'Total uses'),
    perCustomerLimit: optionalWhole(body.perCustomerLimit, 'Uses per customer'),
    startsAt,
    endsAt,
    showInCheckout: !isAuto && Boolean(body.showInCheckout),
  };
}

export async function POST(request: Request) {
  try {
    const merchant = await getLoggedInMerchant();
    if (!merchant) return unauthorized();

    const body = await request.json();
    const data = ruleFromBody(body);
    const id = typeof body.id === 'string' && body.id ? body.id : null;

    if (data.code) {
      const taken = await prisma.discount.findFirst({
        where: { merchantId: merchant.id, code: data.code, ...(id ? { NOT: { id } } : {}) },
        select: { id: true },
      });
      if (taken) throw new InvalidRule('You already have a discount with this code.');
    }

    if (id) {
      const updated = await prisma.discount.updateMany({ where: { id, merchantId: merchant.id }, data });
      if (updated.count === 0) return NextResponse.json({ success: false, error: 'Discount not found.' }, { status: 404 });
      return NextResponse.json({ success: true, id });
    }

    const created = await prisma.discount.create({ data: { ...data, merchantId: merchant.id } });
    return NextResponse.json({ success: true, id: created.id });
  } catch (error) {
    if (error instanceof InvalidRule) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    console.error('Save Discount Error:', error);
    return NextResponse.json({ success: false, error: 'Could not save this discount.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const merchant = await getLoggedInMerchant();
    if (!merchant) return unauthorized();

    const { id } = await request.json();
    const deleted = typeof id === 'string' ? await prisma.discount.deleteMany({ where: { id, merchantId: merchant.id } }) : { count: 0 };
    if (deleted.count === 0) return NextResponse.json({ success: false, error: 'Discount not found.' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete Discount Error:', error);
    return NextResponse.json({ success: false, error: 'Could not delete this discount.' }, { status: 500 });
  }
}
