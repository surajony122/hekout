import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLoggedInMerchant, unauthorized } from '@/lib/merchant-auth';
import { RULE_METHODS } from '@/lib/checkout-rules';

const listOf = (value: unknown) =>
  Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean).slice(0, 500) : [];

export async function POST(request: Request) {
  try {
    const merchant = await getLoggedInMerchant();
    if (!merchant) return unauthorized();

    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '';
    const fee = Number(body.fee);
    const minCart = Number(body.minCart || 0);
    const maxCart = body.maxCart === '' || body.maxCart === null || body.maxCart === undefined ? null : Number(body.maxCart);
    const states = listOf(body.states);
    const pincodes = listOf(body.pincodes);
    const paymentMethods = listOf(body.paymentMethods);

    const problem =
      !name ? 'Please give the rule a name.' :
      !Number.isFinite(fee) || fee < 0 ? "The fee can't be negative." :
      !Number.isFinite(minCart) || minCart < 0 ? "The minimum cart value can't be negative." :
      maxCart !== null && (!Number.isFinite(maxCart) || maxCart <= minCart) ? 'The maximum cart value must be more than the minimum.' :
      pincodes.some((pincode) => !/^\d{1,6}\*?$/.test(pincode) || (!pincode.endsWith('*') && pincode.length !== 6)) ? 'Pincodes need 6 digits, or the first digits followed by * (like 110*).' :
      paymentMethods.some((method) => !RULE_METHODS.includes(method)) ? 'Please choose valid payment methods.' :
      null;
    if (problem) return NextResponse.json({ success: false, error: problem }, { status: 400 });

    const data = { name, fee, minCart, maxCart, states, pincodes, paymentMethods, isActive: body.isActive !== false };
    if (typeof body.id === 'string' && body.id) {
      const updated = await prisma.shippingRule.updateMany({ where: { id: body.id, merchantId: merchant.id }, data });
      if (updated.count === 0) return NextResponse.json({ success: false, error: 'Rule not found.' }, { status: 404 });
      return NextResponse.json({ success: true, id: body.id });
    }
    const created = await prisma.shippingRule.create({ data: { ...data, merchantId: merchant.id } });
    return NextResponse.json({ success: true, id: created.id });
  } catch (error) {
    console.error('Save Shipping Rule Error:', error);
    return NextResponse.json({ success: false, error: 'Could not save this rule.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const merchant = await getLoggedInMerchant();
    if (!merchant) return unauthorized();

    const { id } = await request.json();
    const deleted = typeof id === 'string' ? await prisma.shippingRule.deleteMany({ where: { id, merchantId: merchant.id } }) : { count: 0 };
    if (deleted.count === 0) return NextResponse.json({ success: false, error: 'Rule not found.' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete Shipping Rule Error:', error);
    return NextResponse.json({ success: false, error: 'Could not delete this rule.' }, { status: 500 });
  }
}
