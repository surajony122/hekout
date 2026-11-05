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

// A returning customer's details, found using the phone number they just verified.
async function findShopper(merchant: ShopMerchant, phone: string): Promise<Shopper> {
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
export async function createShopifyCheckout(merchant: ShopMerchant, plan: string, phone: string | null, items: CartLine[]): Promise<string> {
  const [token, shopper] = await Promise.all([
    storefrontToken(merchant),
    phone ? findShopper(merchant, phone) : Promise.resolve({} as Shopper),
  ]);

  const baseInput = {
    lines: items.map((item) => ({
      merchandiseId: `gid://shopify/ProductVariant/${item.variantId}`,
      quantity: item.quantity,
    })),
    attributes: [{ key: PLAN_ATTRIBUTE, value: plan }],
    buyerIdentity: {
      ...(phone ? { phone: formatPhone(phone) } : {}),
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
