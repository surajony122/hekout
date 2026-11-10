// Loads public/widget.js into a jsdom storefront page. The widget's fetch goes to the real
// test app unless a test answers a path itself, so whole journeys can run end to end.
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';
import { ROOT, baseUrl } from './app.mjs';

const WIDGET_ORIGIN = 'https://app.checkoutflow.test';
const widgetSource = () => fs.readFileSync(path.join(ROOT, 'public/widget.js'), 'utf8');

const jsonResponse = (status, data) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => data,
  text: async () => JSON.stringify(data),
});

export function openStorefront({ overrides = {}, localStorage = {}, beforeLoad } = {}) {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => {
    // Leaving the page (to Shopify or the order page) isn't something jsdom does.
    if (!String(error.message).includes('navigation')) errors.push(error);
  });

  const dom = new JSDOM(
    `<!doctype html><html><head><script src="${WIDGET_ORIGIN}/widget.js"></script></head><body><main>Store</main></body></html>`,
    { url: 'https://my-brand.example/products/tee', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole },
  );
  const { window } = dom;
  const requests = [];

  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.scrollTo = () => {};
  for (const [key, value] of Object.entries(localStorage)) window.localStorage.setItem(key, JSON.stringify(value));

  window.fetch = async (input, init = {}) => {
    const url = new URL(String(input), window.location.href);
    const body = init.body ? JSON.parse(init.body) : undefined;
    requests.push({ path: url.pathname, search: url.search, method: init.method ?? 'GET', body });
    const override = overrides[url.pathname];
    if (override) {
      const result = await override({ url, body });
      return jsonResponse(result.status ?? 200, result.body ?? result);
    }
    if (url.origin !== WIDGET_ORIGIN) return jsonResponse(404, {});
    const res = await fetch(baseUrl + url.pathname + url.search, {
      method: init.method ?? 'GET',
      headers: init.headers,
      body: init.body,
    });
    return jsonResponse(res.status, await res.json());
  };

  beforeLoad?.(window);
  window.eval(widgetSource());

  const root = () => window.document.getElementById('checkoutflow-host')?.shadowRoot;
  const $ = (id) => root()?.getElementById(id);
  const visible = (id) => {
    const element = $(id);
    return Boolean(element) && element.style.display !== 'none' && element.style.display !== '';
  };
  const type = (id, value) => {
    const element = $(id);
    element.value = value;
    element.dispatchEvent(new window.Event('input', { bubbles: true }));
  };
  const click = (target) => (typeof target === 'string' ? $(target) : target).click();

  return { window, dom, requests, errors, root, $, visible, type, click, requestsTo: (p) => requests.filter((r) => r.path === p) };
}

export async function waitFor(check, { timeout = 5000, interval = 20, message } = {}) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await check();
      if (value !== false && value !== undefined && value !== null) return value;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error(`Timed out waiting${message ? ` for ${message}` : ''}${lastError ? `: ${lastError.message}` : ''}`);
}
