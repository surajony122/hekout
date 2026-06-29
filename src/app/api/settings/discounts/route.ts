import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const merchantId = searchParams.get('merchantId');

    if (!merchantId) {
      return NextResponse.json({ success: false, error: 'Merchant ID required' }, { status: 400 });
    }

    const discounts = await prisma.discount.findMany({
      where: { merchantId },
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
    const data = await request.json();
    const { merchantId, id, code, title, description, type, value, minItems, minCartValue, isAuto, isActive } = data;

    if (!merchantId || !code || !value) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const payload = {
      merchantId,
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
      // Update
      const discount = await prisma.discount.update({
        where: { id },
        data: payload
      });
      return NextResponse.json({ success: true, discount });
    } else {
      // Create
      const discount = await prisma.discount.create({
        data: payload
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
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Discount ID required' }, { status: 400 });
    }

    await prisma.discount.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete Discount Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
