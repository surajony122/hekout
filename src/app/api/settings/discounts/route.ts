import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLoggedInMerchant, unauthorized } from '@/lib/merchant-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const merchant = await getLoggedInMerchant();
    if (!merchant) return unauthorized();

    const discounts = await prisma.discount.findMany({
      where: { merchantId: merchant.id },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ success: true, discounts });
  } catch (error) {
    console.error('Fetch Discounts Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const merchant = await getLoggedInMerchant();
    if (!merchant) return unauthorized();

    const data = await request.json();
    const { id, code, title, description, type, value, minItems, minCartValue, isAuto, isActive } = data;

    if (!code || !value) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const payload = {
      code: code.toUpperCase(),
      title,
      description,
      type,
      value: parseFloat(value),
      minItems: parseInt(minItems) || 0,
      minCartValue: parseFloat(minCartValue) || 0,
      isAuto,
      isActive
    };

    if (id) {
      // Update, only if this discount belongs to the logged-in store
      const updated = await prisma.discount.updateMany({
        where: { id, merchantId: merchant.id },
        data: payload
      });
      if (updated.count === 0) {
        return NextResponse.json({ success: false, error: 'Discount not found' }, { status: 404 });
      }
      const discount = await prisma.discount.findUnique({ where: { id } });
      return NextResponse.json({ success: true, discount });
    } else {
      // Create
      const discount = await prisma.discount.create({
        data: { ...payload, merchantId: merchant.id }
      });
      return NextResponse.json({ success: true, discount });
    }
  } catch (error) {
    console.error('Save Discount Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const merchant = await getLoggedInMerchant();
    if (!merchant) return unauthorized();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Discount ID required' }, { status: 400 });
    }

    const deleted = await prisma.discount.deleteMany({
      where: { id, merchantId: merchant.id }
    });
    if (deleted.count === 0) {
      return NextResponse.json({ success: false, error: 'Discount not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete Discount Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
