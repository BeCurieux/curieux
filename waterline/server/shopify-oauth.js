// Shopify OAuth (per-merchant install) + webhook verification.
//
// Flow: GET /auth?shop=… → redirect to Shopify consent → GET /auth/callback
// (verify HMAC, exchange code → offline access token, store it, register
// webhooks, run first sync). Webhooks (orders/refunds) verify the request HMAC
// and re-sync. Inert until SHOPIFY_API_KEY + SHOPIFY_API_SECRET are set.

import crypto from 'node:crypto'

const API_KEY = process.env.SHOPIFY_API_KEY
const API_SECRET = process.env.SHOPIFY_API_SECRET
const APP_URL = process.env.APP_URL || 'http://localhost:8787' // public base of THIS API
// Read scopes for ingestion (BUILD_SPEC §3). Write scopes are requested later,
// only when Autopilot needs to act (write_products, write_price_rules, …).
export const SCOPES = process.env.SHOPIFY_SCOPES || 'read_orders,read_products,read_inventory,read_returns,read_discounts,read_reports'

export const isConfigured = () => !!API_KEY && !!API_SECRET

const validShop = (shop) => typeof shop === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shop)

// Step 1 — build the consent URL to redirect the merchant to.
export function installUrl(shop, state) {
  if (!validShop(shop)) throw new Error('invalid shop domain')
  const params = new URLSearchParams({
    client_id: API_KEY,
    scope: SCOPES,
    redirect_uri: `${APP_URL}/auth/callback`,
    state,
  })
  return `https://${shop}/admin/oauth/authorize?${params}`
}

// Verify the OAuth callback query HMAC (constant-time).
export function verifyCallbackHmac(query) {
  const { hmac, signature, ...rest } = query
  const message = Object.keys(rest).sort().map((k) => `${k}=${rest[k]}`).join('&')
  const digest = crypto.createHmac('sha256', API_SECRET).update(message).digest('hex')
  return safeEqualHex(digest, hmac)
}

// Step 2 — exchange the temporary code for a permanent offline access token.
export async function exchangeToken(shop, code) {
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: API_KEY, client_secret: API_SECRET, code }),
  })
  if (!res.ok) throw new Error('token exchange failed: ' + res.status)
  const json = await res.json()
  return json.access_token
}

// Register the webhooks we rely on (BUILD_SPEC §3): orders + refunds.
export async function registerWebhooks(shop, token) {
  const topics = ['ORDERS_CREATE', 'ORDERS_UPDATED', 'REFUNDS_CREATE']
  const callbackUrl = `${APP_URL}/webhooks`
  for (const topic of topics) {
    const mutation = `mutation { webhookSubscriptionCreate(topic: ${topic}, webhookSubscription: { callbackUrl: "${callbackUrl}", format: JSON }) { userErrors { message } } }`
    await fetch(`https://${shop}/admin/api/2025-01/graphql.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
      body: JSON.stringify({ query: mutation }),
    }).catch((e) => console.warn('[shopify] webhook register failed:', topic, e.message))
  }
}

// Verify an incoming webhook against the raw request body.
export function verifyWebhook(rawBody, hmacHeader) {
  if (!API_SECRET || !rawBody || !hmacHeader) return false
  const digest = crypto.createHmac('sha256', API_SECRET).update(rawBody).digest('base64')
  return safeEqualB64(digest, hmacHeader)
}

function safeEqualHex(a, b) {
  try { return !!b && crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex')) } catch { return false }
}
function safeEqualB64(a, b) {
  try { return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)) } catch { return false }
}

export { validShop }
