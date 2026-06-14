import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { merchantId, ...settingsData } = data;

    if (!merchantId) {
      return NextResponse.json({ success: false, error: 'Merchant ID required' }, { status: 400 });
    }

    const settings = await prisma.widgetSettings.upsert({
      where: { merchantId },
      update: settingsData,
      create: {
        merchantId,
        ...settingsData
      }
    });

    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error('Widget Settings Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
