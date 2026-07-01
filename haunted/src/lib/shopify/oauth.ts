// Shopify OAuth (install) + webhook HMAC (CLAUDE.md §Stack: OAuth for install).
// Offline access token → stored encrypted on the shop row.

import crypto from 'node:crypto';

const API_KEY = () => process.env.SHOPIFY_API_KEY ?? '';
const API_SECRET = () => process.env.SHOPIFY_API_SECRET ?? '';
const APP_URL = () => process.env.APP_URL ?? 'http://localhost:3000';
export const SCOPES = () =>
  process.env.SHOPIFY_SCOPES ?? 'read_products,write_products,read_inventory';
export const API_VERSION = '2025-01';

export const isConfigured = () => !!API_KEY() && !!API_SECRET();

export function validShop(shop: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shop);
}

export function installUrl(shop: string, state: string): string {
  if (!validShop(shop)) throw new Error('invalid shop domain');
  const params = new URLSearchParams({
    client_id: API_KEY(),
    scope: SCOPES(),
    redirect_uri: `${APP_URL()}/api/auth/callback`,
    state,
  });
  return `https://${shop}/admin/oauth/authorize?${params}`;
}

// Verify the OAuth callback query HMAC (constant-time).
export function verifyCallbackHmac(query: Record<string, string>): boolean {
  const { hmac, signature: _sig, ...rest } = query;
  if (!hmac) return false;
  const message = Object.keys(rest)
    .sort()
    .map((k) => `${k}=${rest[k]}`)
    .join('&');
  const digest = crypto.createHmac('sha256', API_SECRET()).update(message).digest('hex');
  return safeEqualHex(digest, hmac);
}

// Verify a webhook request body HMAC (base64, from X-Shopify-Hmac-Sha256).
export function verifyWebhookHmac(rawBody: string, headerHmac: string | null): boolean {
  if (!headerHmac) return false;
  const digest = crypto.createHmac('sha256', API_SECRET()).update(rawBody, 'utf8').digest('base64');
  return safeEqualB64(digest, headerHmac);
}

export async function exchangeToken(shop: string, code: string): Promise<string> {
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: API_KEY(), client_secret: API_SECRET(), code }),
  });
  if (!res.ok) throw new Error(`token exchange failed: ${res.status}`);
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

// Register the webhooks the trigger engine relies on: products/update (back in
// stock + price) and app/uninstalled (mark uninstalled_at, stop sending).
export async function registerWebhooks(shop: string, token: string): Promise<void> {
  const topics: Array<[string, string]> = [
    ['PRODUCTS_UPDATE', `${APP_URL()}/api/webhooks/products-update`],
    ['APP_UNINSTALLED', `${APP_URL()}/api/webhooks/app-uninstalled`],
  ];
  for (const [topic, callbackUrl] of topics) {
    const mutation = `mutation {
      webhookSubscriptionCreate(topic: ${topic}, webhookSubscription: { callbackUrl: "${callbackUrl}", format: JSON }) {
        userErrors { message }
      }
    }`;
    await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
      body: JSON.stringify({ query: mutation }),
    });
  }
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}
function safeEqualB64(a: string, b: string): boolean {
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'base64'), Buffer.from(b, 'base64'));
  } catch {
    return false;
  }
}
