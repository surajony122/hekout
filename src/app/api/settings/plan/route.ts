import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLoggedInMerchant, unauthorized } from '@/lib/merchant-auth';
import { CHECKOUT_PLANS, isCheckoutPlan } from '@/lib/plans';

export async function POST(request: Request) {
  try {
    const merchant = await getLoggedInMerchant();
    if (!merchant) return unauthorized();

    const { plan } = await request.json();

    if (!isCheckoutPlan(plan) || !CHECKOUT_PLANS[plan].available) {
      return NextResponse.json({ success: false, error: 'This plan is not available.' }, { status: 400 });
    }

    await prisma.merchant.update({
      where: { id: merchant.id },
      data: { checkoutPlan: plan }
    });

    return NextResponse.json({ success: true, plan });
  } catch (error) {
    console.error('Save Plan Error:', error);
    return NextResponse.json({ success: false, error: 'Could not save your plan.' }, { status: 500 });
  }
}
