import { prisma } from '@/lib/prisma';
import { protectSecret, revealSecret } from '@/lib/secrets';

const API_VERSION = '2026-07';

// Marks carts we create, so Plan 1 orders can be recognised when Shopify reports them.
export const PLAN_ATTRIBUTE = '_checkoutflow_plan';

type ShopMerchant = { id: string; shopDomain: string; accessToken: string | null; storefrontToken: string | null };

type CartLine = { variantId: string; quantity: number };

type Shopper = {
  email?: string;
  address?: {
    firstName?: string;
    lastName?: string;
    address1: string;
    address2?: string;
    city?: string;
    provinceCode?: string;
    countryCode: string;
    zip?: string;
    phone: string;
  };
};

const FIND_CUSTOMER = `query FindCustomer($query: String!) {
  customers(first: 1, query: $query) {
    nodes {
      firstName
      lastName
      defaultEmailAddress { emailAddress }
      defaultAddress { firstName lastName address1 address2 city provinceCode countryCodeV2 zip }
    }
  }
}`;

const CREATE_STOREFRONT_TOKEN = `mutation CreateStorefrontToken($input: StorefrontAccessTokenInput!) {
  storefrontAccessTokenCreate(input: $input) {
    storefrontAccessToken { accessToken }
    userErrors { field message }
  }
}`;

const CREATE_CHECKOUT = `mutation CreateCheckout($input: CartInput!) {
  cartCreate(input: $input) {
    cart { id checkoutUrl }
    userErrors { field message code }
    warnings { code message }
  }
}`;

const STORE_HOST = `query StoreHost {
  shop { primaryDomain { host } }
}`;

// Shopify's codes for Indian states. A name we don't recognise is simply left out.
const INDIAN_STATE_CODES: Record<string, string> = {
  'andaman and nicobar islands': 'AN', 'andhra pradesh': 'AP', 'arunachal pradesh': 'AR', assam: 'AS', bihar: 'BR',
  chandigarh: 'CH', chhattisgarh: 'CG', chattisgarh: 'CG', 'dadra and nagar haveli': 'DN',
  'dadra and nagar haveli and daman and diu': 'DN', 'daman and diu': 'DD', delhi: 'DL', goa: 'GA', gujarat: 'GJ',
  haryana: 'HR', 'himachal pradesh': 'HP', 'jammu and kashmir': 'JK', jharkhand: 'JH', karnataka: 'KA', kerala: 'KL',
  ladakh: 'LA', lakshadweep: 'LD', 'madhya pradesh': 'MP', maharashtra: 'MH', manipur: 'MN', meghalaya: 'ML',
  mizoram: 'MZ', nagaland: 'NL', odisha: 'OR', orissa: 'OR', puducherry: 'PY', pondicherry: 'PY', punjab: 'PB',
  rajasthan: 'RJ', sikkim: 'SK', 'tamil nadu': 'TN', telangana: 'TS', tripura: 'TR', 'uttar pradesh': 'UP',
  uttarakhand: 'UK', uttaranchal: 'UK', 'west bengal': 'WB',
};

const stateCode = (state: string | null) =>
  state ? INDIAN_STATE_CODES[state.trim().toLowerCase().replace(/\s*&\s*/g, ' and ').replace(/\s+/g, ' ')] : undefined;

const STORE_HOST_CACHE_MS = 60 * 60 * 1000;
const storeHosts = new Map<string, { host: string; expires: number }>();

const formatPhone = (phone: string) => (phone.length === 10 ? `+91${phone}` : `+${phone}`);

async function adminGraphql(merchant: ShopMerchant, query: string, variables: unknown) {
  const res = await fetch(`https://${merchant.shopDomain}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': revealSecret(merchant.accessToken) ?? '',
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.data || body.errors) {
    throw new Error(`Shopify Admin API error ${res.status}: ${JSON.stringify(body?.errors ?? null)}`);
  }
  return body.data;
}

async function storefrontToken(merchant: ShopMerchant): Promise<string> {
  const saved = revealSecret(merchant.storefrontToken);
  if (saved) return saved;

  const data = await adminGraphql(merchant, CREATE_STOREFRONT_TOKEN, { input: { title: 'CheckoutFlow' } });
  const { storefrontAccessToken, userErrors } = data.storefrontAccessTokenCreate;
  if (userErrors.length > 0 || !storefrontAccessToken) {
    throw new Error(`Could not create a Storefront token: ${JSON.stringify(userErrors)}`);
  }

  await prisma.merchant.update({
    where: { id: merchant.id },
    data: { storefrontToken: protectSecret(storefrontAccessToken.accessToken) },
  });
  return storefrontAccessToken.accessToken;
}

// The address customers shop on, which a phone needs in the SMS to fill the code in itself.
// It comes from Shopify and never the browser, so a code can't be tied to another site.
export async function storeHost(merchant: ShopMerchant): Promise<string> {
  const cached = storeHosts.get(merchant.shopDomain);
  if (cached && cached.expires > Date.now()) return cached.host;
  try {
    const data = await adminGraphql(merchant, STORE_HOST, {});
    const host: string = data.shop.primaryDomain.host;
    storeHosts.set(merchant.shopDomain, { host, expires: Date.now() + STORE_HOST_CACHE_MS });
    return host;
  } catch (error) {
    console.error('Store Domain Error:', error);
    return merchant.shopDomain;
  }
}

// The details this customer gave in our popup, for when Shopify has none under their phone.
async function findSavedProfile(merchant: ShopMerchant, phone: string): Promise<Shopper> {
  const profile = await prisma.customerProfile.findFirst({
    where: { merchantId: merchant.id, phone },
    orderBy: { lastOrderAt: 'desc' },
  });
  if (!profile) return {};

  const [firstName, ...otherNames] = (profile.name ?? '').trim().split(/\s+/);
  return {
    email: profile.email || undefined,
    address: profile.address
      ? {
          firstName: firstName || undefined,
          lastName: otherNames.join(' ') || undefined,
          address1: profile.address,
          city: profile.city || undefined,
          provinceCode: stateCode(profile.state),
          countryCode: 'IN',
          zip: profile.pincode || undefined,
          phone: formatPhone(phone),
        }
      : undefined,
  };
}

// A returning customer's details, found using the phone number they just verified.
async function findShopifyCustomer(merchant: ShopMerchant, phone: string): Promise<Shopper> {
  try {
    const data = await adminGraphql(merchant, FIND_CUSTOMER, { query: `phone:${formatPhone(phone)}` });
    const customer = data.customers.nodes[0];
    if (!customer) return {};

    const saved = customer.defaultAddress;
    return {
      email: customer.defaultEmailAddress?.emailAddress ?? undefined,
      address: saved?.address1
        ? {
            firstName: saved.firstName ?? customer.firstName ?? undefined,
            lastName: saved.lastName ?? customer.lastName ?? undefined,
            address1: saved.address1,
            address2: saved.address2 ?? undefined,
            city: saved.city ?? undefined,
            provinceCode: saved.provinceCode ?? undefined,
            countryCode: saved.countryCodeV2 ?? 'IN',
            zip: saved.zip ?? undefined,
            phone: formatPhone(phone),
          }
        : undefined,
    };
  } catch (error) {
    // Their details are a convenience, so checkout carries on without them.
    console.error('Find Customer Error:', error);
    return {};
  }
}

// Shopify's record comes first, and our own fills whatever it's missing.
async function findShopper(merchant: ShopMerchant, phone: string): Promise<Shopper> {
  const shopify = await findShopifyCustomer(merchant, phone);
  if (shopify.email && shopify.address) return shopify;

  try {
    const saved = await findSavedProfile(merchant, phone);
    return { email: shopify.email ?? saved.email, address: shopify.address ?? saved.address };
  } catch (error) {
    console.error('Find Saved Profile Error:', error);
    return shopify;
  }
}

async function createCart(merchant: ShopMerchant, token: string, input: unknown) {
  const res = await fetch(`https://${merchant.shopDomain}/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': token,
    },
    body: JSON.stringify({ query: CREATE_CHECKOUT, variables: { input } }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.data || body.errors) {
    throw new Error(`Shopify Storefront API error ${res.status}: ${JSON.stringify(body?.errors ?? null)}`);
  }
  return body.data.cartCreate as {
    cart: { checkoutUrl: string } | null;
    userErrors: { message: string }[];
    warnings: { code: string; message: string }[];
  };
}

// Returns Shopify's checkout link for this cart. Details travel in Shopify's cart, not
// in the link, so a customer's address never appears in a URL.
export async function createShopifyCheckout(merchant: ShopMerchant, plan: string, phone: string, items: CartLine[]): Promise<string> {
  const [token, shopper] = await Promise.all([storefrontToken(merchant), findShopper(merchant, phone)]);

  const baseInput = {
    lines: items.map((item) => ({
      merchandiseId: `gid://shopify/ProductVariant/${item.variantId}`,
      quantity: item.quantity,
    })),
    attributes: [{ key: PLAN_ATTRIBUTE, value: plan }],
    buyerIdentity: {
      phone: formatPhone(phone),
      countryCode: shopper.address?.countryCode ?? 'IN',
      ...(shopper.email ? { email: shopper.email } : {}),
    },
  };

  let result = await createCart(merchant, token, shopper.address
    ? {
        ...baseInput,
        delivery: {
          addresses: [{
            selected: true,
            oneTimeUse: true,
            address: { deliveryAddress: shopper.address },
          }],
        },
      }
    : baseInput);

  // An old saved address shouldn't cost the sale, so try again without it.
  if (!result.cart && shopper.address) {
    console.error('Cart with saved address failed:', JSON.stringify(result.userErrors));
    result = await createCart(merchant, token, baseInput);
  }

  if (!result.cart) {
    throw new Error(`Could not create a cart: ${JSON.stringify(result.userErrors)}`);
  }
  if (result.warnings.length > 0) console.error('Cart warnings:', JSON.stringify(result.warnings.map((w) => w.code)));
  return result.cart.checkoutUrl;
}
