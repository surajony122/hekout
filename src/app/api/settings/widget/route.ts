import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLoggedInMerchant, unauthorized } from '@/lib/merchant-auth';

export async function POST(request: Request) {
  try {
    const merchant = await getLoggedInMerchant();
    if (!merchant) return unauthorized();

    const {
      primaryColor,
      brandLogoUrl,
      preLoginBannerText,
      preLoginBannerBg,
      preLoginBannerColor,
      postLoginBannerText,
      postLoginBannerBg,
      postLoginBannerColor,
      fbPixelId,
      storeName,
    } = await request.json();

    if (typeof storeName === 'string') {
      await prisma.merchant.update({
        where: { id: merchant.id },
        data: { storeName: storeName.trim().slice(0, 40) || null }
      });
    }

    const settingsData = {
      primaryColor,
      brandLogoUrl,
      preLoginBannerText,
      preLoginBannerBg,
      preLoginBannerColor,
      postLoginBannerText,
      postLoginBannerBg,
      postLoginBannerColor,
      fbPixelId,
    };

    const settings = await prisma.widgetSettings.upsert({
      where: { merchantId: merchant.id },
      update: settingsData,
      create: {
        merchantId: merchant.id,
        ...settingsData
      }
    });

    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error('Widget Settings Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
