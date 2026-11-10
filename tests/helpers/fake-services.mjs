// Stand-ins for Shopify, Razorpay and Twilio, answered in-process by nock. The Shopify one
// really works out draft order totals from its own catalogue, so the app's pricing is
// tested against something that behaves like Shopify rather than fixed answers.
import nock from 'nock';
import querystring from 'node:querystring';

const money = (value) => ({ shopMoney: { amount: (Math.round(value * 100) / 100).toFixed(2) } });
const round = (value) => Math.round(value * 100) / 100;

export const shopify = {
  reset() {
    // variantId -> { price, tags, collections: [gid], available }
    this.variants = new Map();
    // CODE -> { type: 'percentage' | 'fixed', value, combinesWithOrderDiscounts, warning }
    this.codes = new Map();
    // { percent } applied while acceptAutomaticDiscounts isn't false
    this.automatic = null;
    this.taxRate = 0;
    // '+91XXXXXXXXXX' -> customer node
    this.customers = new Map();
    this.storeHost = 'shop.example.com';
    this.grantedScopes = ['unauthenticated_write_checkouts', 'write_draft_orders', 'write_orders', 'write_customers', 'write_products'];
    this.calls = [];
    this.drafts = new Map();
    this.orders = new Map();
    this.carts = [];
    this.nextId = 1000;
    this.failCompletes = 0;
    this.failCreates = 0;
    this.priceChangeOnCreate = 0;
    this.failVariantDetails = false;
  },

  callsOf(kind, shop) {
    return this.calls.filter((call) => call.kind === kind && (!shop || call.shop === shop));
  },

  // Works out a draft order the way Shopify does: line discounts, automatic discounts,
  // codes (which drop when they can't combine with an order discount), shipping and tax.
  calculate(input) {
    const userErrors = [];
    const lines = (input.lineItems ?? []).map((line) => {
      const id = String(line.variantId).split('/').pop();
      const variant = this.variants.get(id);
      if (!variant || variant.available === false) {
        userErrors.push({ field: ['lineItems'], message: `Variant ${id} is not available` });
        return null;
      }
      const original = variant.price * line.quantity;
      let lineDiscount = 0;
      if (line.appliedDiscount) {
        lineDiscount = line.appliedDiscount.valueType === 'PERCENTAGE'
          ? original * (line.appliedDiscount.value / 100)
          : Math.min(line.appliedDiscount.value, original);
      }
      return { variant, quantity: line.quantity, original, lineDiscount: round(lineDiscount) };
    });
    if (userErrors.length > 0) return { userErrors };

    const lineTotal = lines.reduce((sum, line) => sum + line.original, 0);
    const lineDiscounts = lines.reduce((sum, line) => sum + line.lineDiscount, 0);
    let remaining = lineTotal - lineDiscounts;

    let automaticDiscount = 0;
    if (this.automatic && input.acceptAutomaticDiscounts !== false) {
      automaticDiscount = round(remaining * (this.automatic.percent / 100));
      remaining -= automaticDiscount;
    }

    const warnings = [];
    const applied = [];
    let codeDiscount = 0;
    for (const typed of input.discountCodes ?? []) {
      const code = this.codes.get(String(typed).toUpperCase());
      if (!code) continue; // Shopify drops unknown codes silently.
      if (code.warning) {
        warnings.push({ errorCode: 'DISCOUNT_NOT_APPLICABLE', field: 'discountCodes', message: code.warning });
        continue;
      }
      if (input.appliedDiscount && !code.combinesWithOrderDiscounts) continue;
      const amount = code.type === 'percentage' ? remaining * (code.value / 100) : Math.min(code.value, remaining);
      codeDiscount += round(amount);
      remaining -= round(amount);
      applied.push(String(typed).toUpperCase());
    }

    const orderDiscount = input.appliedDiscount ? Math.min(input.appliedDiscount.value, remaining) : 0;
    remaining -= orderDiscount;

    const shipping = Number(input.shippingLine?.priceWithCurrency?.amount ?? 0);
    const tax = round(remaining * this.taxRate);
    const totalDiscounts = lineDiscounts + automaticDiscount + codeDiscount + orderDiscount;
    const total = lineTotal - totalDiscounts + shipping + tax;

    return {
      userErrors: [],
      calculatedDraftOrder: {
        currencyCode: 'INR',
        discountCodes: applied,
        warnings,
        totalLineItemsPriceSet: money(lineTotal),
        totalDiscountsSet: money(totalDiscounts),
        totalShippingPriceSet: money(shipping),
        totalTaxSet: money(tax),
        totalPriceSet: money(total),
        lineItems: lines.map((line) => ({
          originalUnitPriceSet: money(line.variant.price),
          discountedTotalSet: money(line.original - line.lineDiscount),
        })),
      },
    };
  },

  adminGraphql(shop, token, { query, variables }) {
    const record = (kind) => this.calls.push({ kind, shop, token, variables });
    if (query.includes('draftOrderCalculate')) {
      record('draftOrderCalculate');
      return { data: { draftOrderCalculate: this.calculate(variables.input) } };
    }
    if (query.includes('draftOrderCreate')) {
      record('draftOrderCreate');
      if (this.failCreates > 0) {
        this.failCreates -= 1;
        return { data: { draftOrderCreate: { draftOrder: null, userErrors: [{ field: null, message: 'Temporary problem' }] } } };
      }
      const result = this.calculate(variables.input);
      if (result.userErrors.length > 0) return { data: { draftOrderCreate: { draftOrder: null, userErrors: result.userErrors } } };
      const legacyId = String(this.nextId++);
      const total = parseFloat(result.calculatedDraftOrder.totalPriceSet.shopMoney.amount) + this.priceChangeOnCreate;
      this.drafts.set(legacyId, { shop, input: variables.input, total, orderId: null });
      return {
        data: {
          draftOrderCreate: {
            draftOrder: { id: `gid://shopify/DraftOrder/${legacyId}`, legacyResourceId: legacyId, totalPriceSet: money(total) },
            userErrors: [],
          },
        },
      };
    }
    if (query.includes('customers(first')) {
      record('findCustomer');
      const phone = String(variables.query).replace(/^phone:/, '');
      const customer = this.customers.get(phone);
      return { data: { customers: { nodes: customer ? [customer] : [] } } };
    }
    if (query.includes('nodes(ids')) {
      record('variantDetails');
      if (this.failVariantDetails) return { errors: [{ message: 'Throttled' }] };
      return {
        data: {
          nodes: variables.ids.map((gid) => {
            const variant = this.variants.get(gid.split('/').pop());
            return variant
              ? { id: gid, product: { tags: variant.tags ?? [], collections: { nodes: (variant.collections ?? []).map((id) => ({ id })) } } }
              : null;
          }),
        },
      };
    }
    if (query.includes('primaryDomain')) {
      record('storeHost');
      return { data: { shop: { primaryDomain: { host: this.storeHost } } } };
    }
    if (query.includes('currentAppInstallation')) {
      record('grantedScopes');
      return { data: { currentAppInstallation: { accessScopes: this.grantedScopes.map((handle) => ({ handle })) } } };
    }
    if (query.includes('storefrontAccessTokenCreate')) {
      record('storefrontTokenCreate');
      return { data: { storefrontAccessTokenCreate: { storefrontAccessToken: { accessToken: 'storefront-test-token' }, userErrors: [] } } };
    }
    record('unknown');
    return { errors: [{ message: `Fake Shopify does not know this query: ${query.slice(0, 80)}` }] };
  },
};

export const razorpay = {
  reset() {
    this.orders = new Map();
    this.payments = new Map();
    this.calls = [];
    this.nextId = 1;
  },
  // Adds a payment as Razorpay would hold it after the customer pays.
  addPayment(payment) {
    const full = { id: `pay_test_${this.nextId++}`, status: 'captured', ...payment };
    this.payments.set(full.id, full);
    return full;
  },
};

export const twilio = {
  reset() {
    this.messages = [];
    this.fail = false;
  },
};

export const msg91 = {
  reset() {
    this.requests = [];
  },
};

// nock hands reply functions the request as a Fetch Request.
const shopOf = (request) => new URL(request.url).hostname;
const pathOf = (request) => { const url = new URL(request.url); return url.pathname + url.search; };
const basicUser = (request) => {
  const header = request.headers.get('authorization') ?? '';
  return header.startsWith('Basic ') ? Buffer.from(header.slice(6), 'base64').toString('utf8').split(':')[0] : null;
};
const jsonBody = async (request) => {
  const text = await request.text();
  try { return JSON.parse(text); } catch { return querystring.parse(text); }
};
const reply = (handler) => async (request) => handler(request, await jsonBody(request));

export function installFakeServices() {
  shopify.reset();
  razorpay.reset();
  twilio.reset();
  msg91.reset();

  nock.disableNetConnect();
  nock.enableNetConnect((host) => host.startsWith('127.0.0.1') || host.startsWith('localhost'));

  const store = /^https:\/\/[a-z0-9-]+\.myshopify\.com(:443)?$/;

  nock(store).persist()
    .post('/admin/api/2026-07/graphql.json')
    .reply(reply((request, body) => [200, shopify.adminGraphql(shopOf(request), request.headers.get('x-shopify-access-token'), body)]))
    .post('/api/2026-07/graphql.json')
    .reply(reply((request, body) => {
      const shop = shopOf(request);
      shopify.carts.push({ shop, token: request.headers.get('x-shopify-storefront-access-token'), input: body.variables.input });
      return [200, { data: { cartCreate: { cart: { id: 'gid://shopify/Cart/1', checkoutUrl: `https://${shop}/cart/c/test-cart` }, userErrors: [], warnings: [] } } }];
    }))
    .put(/\/admin\/api\/2024-01\/draft_orders\/\d+\/complete\.json/)
    .reply(reply((request) => {
      const uri = pathOf(request);
      const draftId = uri.match(/draft_orders\/(\d+)/)[1];
      const paymentPending = uri.includes('payment_pending=true');
      shopify.calls.push({ kind: 'completeDraft', shop: shopOf(request), draftId, paymentPending });
      if (shopify.failCompletes > 0) {
        shopify.failCompletes -= 1;
        return [500, { errors: 'Internal error' }];
      }
      const draft = shopify.drafts.get(draftId);
      if (!draft) return [404, { errors: 'Not Found' }];
      if (!draft.orderId) {
        draft.orderId = String(shopify.nextId++);
        shopify.orders.set(draft.orderId, { draftId, paymentPending, transactions: [] });
      }
      return [200, { draft_order: { id: Number(draftId), order_id: Number(draft.orderId) } }];
    }))
    .get(/\/admin\/api\/2024-01\/draft_orders\/\d+\.json/)
    .reply(reply((request) => {
      const draft = shopify.drafts.get(pathOf(request).match(/draft_orders\/(\d+)/)[1]);
      return draft ? [200, { draft_order: { order_id: draft.orderId ? Number(draft.orderId) : null } }] : [404, { errors: 'Not Found' }];
    }))
    .get(/\/admin\/api\/2024-01\/orders\/\d+\.json/)
    .reply(reply((request) => {
      const id = pathOf(request).match(/orders\/(\d+)/)[1];
      return [200, { order: { id: Number(id), order_status_url: `https://${shopOf(request)}/orders/${id}/status` } }];
    }))
    .post(/\/admin\/api\/2024-01\/orders\/\d+\/transactions\.json/)
    .reply(reply((request, body) => {
      const id = pathOf(request).match(/orders\/(\d+)/)[1];
      shopify.orders.get(id)?.transactions.push(body.transaction);
      return [201, { transaction: { id: 1, ...body.transaction } }];
    }))
    .post('/admin/oauth/access_token')
    .reply(reply((request, body) => {
      shopify.calls.push({ kind: 'tokenExchange', shop: shopOf(request), body });
      return [200, { access_token: `shpat_${shopOf(request).split('.')[0]}`, scope: 'write_orders' }];
    }));

  nock('https://api.razorpay.com').persist()
    .post('/v1/orders')
    .reply(reply((request, body) => {
      const order = { id: `order_test_${razorpay.nextId++}`, entity: 'order', amount: Number(body.amount), currency: body.currency, status: 'created', receipt: body.receipt };
      razorpay.orders.set(order.id, order);
      razorpay.calls.push({ kind: 'createOrder', keyId: basicUser(request), body });
      return [200, order];
    }))
    .get(/\/v1\/payments\/[\w-]+$/)
    .reply(reply((request) => {
      const id = pathOf(request).split('/').pop();
      const payment = razorpay.payments.get(id);
      razorpay.calls.push({ kind: 'fetchPayment', keyId: basicUser(request), id });
      return payment ? [200, payment] : [400, { error: { code: 'BAD_REQUEST_ERROR', description: 'The id provided does not exist' } }];
    }))
    .get(/\/v1\/orders\/[\w-]+\/payments$/)
    .reply(reply((request) => {
      const orderId = pathOf(request).split('/')[3];
      const items = [...razorpay.payments.values()].filter((payment) => payment.order_id === orderId);
      return [200, { entity: 'collection', count: items.length, items }];
    }));

  nock('https://api.twilio.com').persist()
    .post(/\/2010-04-01\/Accounts\/\w+\/Messages\.json/)
    .reply(reply((_request, form) => {
      if (twilio.fail) return [400, { code: 21211, message: 'Invalid To number', status: 400 }];
      twilio.messages.push(form);
      return [201, { sid: `SM${twilio.messages.length}`, status: 'queued', to: form.To, body: form.Body }];
    }));

  nock('https://control.msg91.com').persist()
    .post('/api/v5/otp')
    .reply(reply((_request, body) => {
      msg91.requests.push(body);
      return [200, { type: 'success' }];
    }));
}

export function resetFakeServices() {
  shopify.reset();
  razorpay.reset();
  twilio.reset();
  msg91.reset();
}
