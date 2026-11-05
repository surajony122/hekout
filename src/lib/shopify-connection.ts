import { revealSecret } from '@/lib/secrets';

const API_VERSION = '2026-07';
const CHECK_EVERY_MS = 10 * 60 * 1000;
const CACHE_LIMIT = 5000;

// What the checkout can't work without. Shopify counts a write permission as read too,
// and where either is enough, both are listed.
const REQUIRED_PERMISSIONS = [
  ['unauthenticated_write_checkouts'],
  ['write_draft_orders'],
  ['write_orders'],
  ['write_customers', 'read_customers'],
  ['write_products', 'read_products'],
];

const GRANTED_SCOPES = `query GrantedScopes {
  currentAppInstallation { accessScopes { handle } }
}`;

const checks = new Map<string, { needsReconnect: boolean; expires: number }>();

// True only when Shopify says so. If Shopify can't be reached, there's nothing to warn about yet.
export async function storeNeedsReconnect(merchant: { shopDomain: string; accessToken: string | null }): Promise<boolean> {
  if (!merchant.accessToken) return true;

  // Reconnecting saves a new token, which starts a fresh check straight away.
  const key = `${merchant.shopDomain}|${merchant.accessToken}`;
  const cached = checks.get(key);
  if (cached && cached.expires > Date.now()) return cached.needsReconnect;

  try {
    const res = await fetch(`https://${merchant.shopDomain}/admin/api/${API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': revealSecret(merchant.accessToken),
      },
      body: JSON.stringify({ query: GRANTED_SCOPES }),
      signal: AbortSignal.timeout(3000),
    });

    let needsReconnect: boolean;
    if (res.status === 401) {
      needsReconnect = true;
    } else {
      const body = await res.json();
      const handles: { handle: string }[] | undefined = body?.data?.currentAppInstallation?.accessScopes;
      if (!res.ok || !handles) return false;
      const granted = new Set(handles.map((scope) => scope.handle));
      const missing = REQUIRED_PERMISSIONS.filter((options) => !options.some((scope) => granted.has(scope)));
      needsReconnect = missing.length > 0;
      if (needsReconnect) console.error(`Store ${merchant.shopDomain} is missing permissions: ${missing.map((options) => options[0]).join(', ')}`);
    }

    if (checks.size >= CACHE_LIMIT) checks.clear();
    checks.set(key, { needsReconnect, expires: Date.now() + CHECK_EVERY_MS });
    return needsReconnect;
  } catch (error) {
    console.error('Connection Check Error:', error);
    return false;
  }
}
