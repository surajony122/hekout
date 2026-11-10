import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLoggedInMerchant, unauthorized } from '@/lib/merchant-auth';
import { isEncryptionConfigured, protectSecret } from '@/lib/secrets';

// IDs end up in the checkout's tracking scripts, so each must match its exact format.
const TRACKING_IDS = {
  ga4MeasurementId: { pattern: /^G-[A-Z0-9]{4,20}$/, error: 'A GA4 Measurement ID looks like G-XXXXXXXXXX.' },
  googleAdsId: { pattern: /^AW-\d{5,15}$/, error: 'A Google Ads ID looks like AW-123456789.' },
  googleAdsLabel: { pattern: /^[A-Za-z0-9_-]{4,40}$/, error: 'Please paste the conversion label from Google Ads.' },
} as const;
const META_TOKEN = /^[A-Za-z0-9_-]{20,1000}$/;

// undefined leaves a saved ID alone, and an empty value removes it.
function trackingId(value: unknown, name: keyof typeof TRACKING_IDS): string | null | undefined {
  if (value === undefined) return undefined;
  const id = typeof value === 'string' ? value.trim() : '';
  if (!id) return null;
  const normalized = name === 'googleAdsLabel' ? id : id.toUpperCase();
  if (!TRACKING_IDS[name].pattern.test(normalized)) throw new InvalidSetting(TRACKING_IDS[name].error);
  return normalized;
}

class InvalidSetting extends Error {}

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
      ga4MeasurementId,
      googleAdsId,
      googleAdsLabel,
      metaCapiToken,
      removeMetaCapiToken,
    } = await request.json();

    // The ID ends up in the checkout's tracking script, so it must be just digits.
    if (fbPixelId && !/^\d{5,20}$/.test(String(fbPixelId))) {
      return NextResponse.json({ success: false, error: 'A Pixel ID should contain only numbers.' }, { status: 400 });
    }

    const tracking = {
      ga4MeasurementId: trackingId(ga4MeasurementId, 'ga4MeasurementId'),
      googleAdsId: trackingId(googleAdsId, 'googleAdsId'),
      googleAdsLabel: trackingId(googleAdsLabel, 'googleAdsLabel'),
    };
    if (tracking.googleAdsLabel && googleAdsId !== undefined && !tracking.googleAdsId) {
      throw new InvalidSetting('Add the Google Ads ID for this conversion label.');
    }

    // The token can post events to the store's Meta account, so it is kept encrypted and never sent back.
    let metaToken: { metaCapiToken?: string | null } = {};
    if (removeMetaCapiToken === true) {
      metaToken = { metaCapiToken: null };
    } else if (typeof metaCapiToken === 'string' && metaCapiToken.trim()) {
      if (!META_TOKEN.test(metaCapiToken.trim())) throw new InvalidSetting('Please paste the whole Conversions API access token.');
      if (!isEncryptionConfigured()) {
        return NextResponse.json({ success: false, error: 'Secure key storage is not set up yet, so your token was not saved.' }, { status: 503 });
      }
      metaToken = { metaCapiToken: protectSecret(metaCapiToken.trim()) };
    }

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
      ...tracking,
      ...metaToken,
    };

    const settings = await prisma.widgetSettings.upsert({
      where: { merchantId: merchant.id },
      update: settingsData,
      create: {
        merchantId: merchant.id,
        ...settingsData
      }
    });

    const { metaCapiToken: savedToken, ...visible } = settings;
    return NextResponse.json({ success: true, settings: { ...visible, hasMetaCapiToken: Boolean(savedToken) } });
  } catch (error) {
    if (error instanceof InvalidSetting) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    console.error('Widget Settings Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
