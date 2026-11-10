import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { revealSecret } from '@/lib/secrets';

// Meta's Conversions API. Supported until 2028, per Meta's version list.
export const META_GRAPH_VERSION = 'v25.0';
const SEVEN_DAYS_S = 7 * 24 * 60 * 60;

// What the customer's browser had when they ordered, so Meta can match the server's event to them.
export type TrackingContext = {
  fbp?: string;
  fbc?: string;
  sourceUrl?: string;
  ip?: string;
  userAgent?: string;
};

const FB_COOKIE = /^fb\.\d\.\d{10,16}\.[\w.-]{1,250}$/;

export function trackingFromRequest(request: Request, sent: unknown): TrackingContext {
  const body = (sent && typeof sent === 'object' ? sent : {}) as Record<string, unknown>;
  const cookie = (value: unknown) => (typeof value === 'string' && FB_COOKIE.test(value) ? value : undefined);
  const url = typeof body.sourceUrl === 'string' && /^https?:\/\//.test(body.sourceUrl) ? body.sourceUrl.slice(0, 500) : undefined;
  // Render sits behind Cloudflare, which sets this header itself.
  const ip = request.headers.get('cf-connecting-ip') ?? undefined;
  const userAgent = request.headers.get('user-agent')?.slice(0, 500) ?? undefined;
  return { fbp: cookie(body.fbp), fbc: cookie(body.fbc), sourceUrl: url, ip, userAgent };
}

const hash = (value: string | null | undefined) => {
  const clean = value?.trim().toLowerCase();
  return clean ? crypto.createHash('sha256').update(clean).digest('hex') : undefined;
};

type OrderForMeta = {
  id: string;
  createdAt: Date;
  total: number;
  quantity: number;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  city: string | null;
  pincode: string | null;
  fulfillmentData: unknown;
};

// The event Meta receives. Its ID matches the browser pixel's, so a purchase seen by both counts once.
export function purchaseEvent(order: OrderForMeta) {
  const saved = (order.fulfillmentData ?? {}) as { tracking?: TrackingContext; draftInput?: { lineItems?: { variantId?: string; quantity?: number; appliedDiscount?: { title?: string } }[] } };
  const tracking = saved.tracking ?? {};
  // Free gifts aren't something the customer bought.
  const lines = (saved.draftInput?.lineItems ?? [])
    .filter((line) => line.appliedDiscount?.title !== 'Free Gift')
    .map((line) => ({ id: String(line.variantId ?? '').split('/').pop() ?? '', quantity: Number(line.quantity) || 1 }))
    .filter((line) => line.id);
  const phone = order.customerPhone?.replace(/\D/g, '');
  const [firstName, ...rest] = (order.customerName ?? '').trim().split(/\s+/);
  const now = Math.floor(Date.now() / 1000);

  return {
    event_name: 'Purchase',
    event_time: Math.max(Math.floor(order.createdAt.getTime() / 1000), now - SEVEN_DAYS_S + 60),
    event_id: `order_${order.id}`,
    action_source: 'website',
    ...(tracking.sourceUrl ? { event_source_url: tracking.sourceUrl } : {}),
    user_data: Object.fromEntries(Object.entries({
      ph: phone ? [hash(phone.length === 10 ? `91${phone}` : phone)] : undefined,
      em: order.customerEmail ? [hash(order.customerEmail)] : undefined,
      fn: firstName && firstName !== 'Valued' ? [hash(firstName)] : undefined,
      ln: rest.length > 0 && firstName !== 'Valued' ? [hash(rest.join(' '))] : undefined,
      ct: order.city ? [hash(order.city.replace(/\s+/g, ''))] : undefined,
      zp: order.pincode ? [hash(order.pincode)] : undefined,
      country: [hash('in')],
      external_id: phone ? [hash(phone)] : undefined,
      client_ip_address: tracking.ip,
      client_user_agent: tracking.userAgent,
      fbp: tracking.fbp,
      fbc: tracking.fbc,
    }).filter(([, value]) => value !== undefined)),
    custom_data: {
      currency: 'INR',
      value: order.total,
      order_id: order.id,
      content_type: 'product',
      content_ids: lines.map((line) => line.id),
      contents: lines,
      num_items: order.quantity,
    },
  };
}

// Sends a placed popup order to Meta, when the store has a Pixel and a Conversions API token.
// A failure is only logged, since tracking must never affect an order.
export async function sendMetaPurchase(merchantId: string, orderId: string) {
  try {
    const settings = await prisma.widgetSettings.findUnique({ where: { merchantId } });
    const pixelId = settings?.fbPixelId?.trim();
    const token = revealSecret(settings?.metaCapiToken)?.trim();
    if (!pixelId || !/^\d{5,20}$/.test(pixelId) || !token) return false;

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return false;

    const res = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${pixelId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [purchaseEvent(order)], access_token: token }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      console.error(`Meta Conversions API refused order ${orderId}:`, res.status, JSON.stringify(body?.error?.message ?? body));
      return false;
    }
    return true;
  } catch (error) {
    console.error(`Meta Conversions API error for order ${orderId}:`, error);
    return false;
  }
}
