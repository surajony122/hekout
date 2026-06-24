import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const merchantId = searchParams.get('merchantId');
  if (!merchantId) return NextResponse.json({ error: 'Merchant ID required' }, { status: 400 });

  const discounts = await prisma.discount.findMany({
    where: { merchantId },
    orderBy: { createdAt: 'desc' }
  });
  return NextResponse.json({ success: true, discounts });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { merchantId, id, code, title, description, type, value, isAuto, canCombine, minItems, minCartValue, maxDiscount, isActive } = body;

    if (!merchantId || !code || value === undefined) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });

    if (id) {
       const discount = await prisma.discount.update({
         where: { id },
         data: { code, title, description, type, value: parseFloat(value), isAuto, canCombine, minItems: parseInt(minItems) || 0, minCartValue: parseFloat(minCartValue) || 0, maxDiscount: maxDiscount ? parseFloat(maxDiscount) : null, isActive }
       });
       return NextResponse.json({ success: true, discount });
    } else {
       const discount = await prisma.discount.create({
         data: { merchantId, code, title, description, type, value: parseFloat(value), isAuto: isAuto || false, canCombine: canCombine || false, minItems: parseInt(minItems) || 0, minCartValue: parseFloat(minCartValue) || 0, maxDiscount: maxDiscount ? parseFloat(maxDiscount) : null, isActive: isActive ?? true }
       });
       return NextResponse.json({ success: true, discount });
    }
  } catch (error) {
    console.error('Save Discount Error:', error);
    return NextResponse.json({ error: 'Failed to save discount' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  await prisma.discount.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
