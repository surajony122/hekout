import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { MERCHANT_SESSION_COOKIE, readMerchantSessionToken } from '@/lib/merchant-session';

// Everything requires a merchant login unless it is listed here. These are the
// login flow and the APIs the storefront checkout widget calls for customers.
const PUBLIC_PATHS = [
  '/login',
  '/api/auth',
  '/api/create-order',
  '/api/checkout',
  '/api/otp',
  '/api/customer',
  '/api/widget',
  '/api/upsell',
];

const isPublic = (pathname: string) =>
  PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

// Proxy redirects must be absolute. The configured URL is the public site, even behind Render's proxy.
function redirectTo(path: string, request: NextRequest) {
  const redirectUri = process.env.SHOPIFY_REDIRECT_URI;
  const origin = redirectUri ? new URL(redirectUri).origin : request.nextUrl.origin;
  return NextResponse.redirect(new URL(path, origin));
}

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const loggedInShop = readMerchantSessionToken(request.cookies.get(MERCHANT_SESSION_COOKIE)?.value);

  // Shopify opens the app at "/?shop=...", so sign that store in if it isn't already.
  const requestedShop = searchParams.get('shop');
  if (pathname === '/' && requestedShop && requestedShop !== loggedInShop) {
    return redirectTo(`/api/auth/shopify?shop=${encodeURIComponent(requestedShop)}`, request);
  }

  if (loggedInShop) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ success: false, error: 'Please log in.' }, { status: 401 });
  }
  return redirectTo('/login', request);
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon\\.ico|widget\\.js|file\\.svg|globe\\.svg|next\\.svg|vercel\\.svg|window\\.svg).*)',
};
