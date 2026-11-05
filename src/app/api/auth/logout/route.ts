import { MERCHANT_SESSION_COOKIE, redirectTo } from '@/lib/merchant-session';

export async function POST() {
  const response = redirectTo('/login', 303);
  response.cookies.delete({ name: MERCHANT_SESSION_COOKIE, path: '/' });
  return response;
}
