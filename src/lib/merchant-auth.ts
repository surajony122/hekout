import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MERCHANT_SESSION_COOKIE, readMerchantSessionToken } from '@/lib/merchant-session';
import { ensureOrderWebhooks } from '@/lib/shopify-order-sync';

// The merchant for this request comes only from the signed session cookie.
export async function getLoggedInMerchant() {
  const cookieStore = await cookies();
  const shop = readMerchantSessionToken(cookieStore.get(MERCHANT_SESSION_COOKIE)?.value);
  if (!shop) return null;

  const merchant = await prisma.merchant.findUnique({ where: { shopDomain: shop } });
  if (!merchant?.isActive) return null;
  // Stores that logged in before order updates existed get them on their next visit.
  ensureOrderWebhooks(merchant).catch(() => {});
  return merchant;
}

export function unauthorized() {
  return NextResponse.json({ success: false, error: 'Please log in.' }, { status: 401 });
}
