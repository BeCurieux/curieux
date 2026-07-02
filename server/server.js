// Waterline backend skeleton — REST API over the in-memory store + margin engine.
//
// Run: npm run server   (defaults to port 8787)
// This is the read-only ingestion + compute + Autopilot layer with server-side
// guardrails and an action log. Real Shopify/ad-platform OAuth + a database are
// the next phase (BUILD_SPEC.md §3, §10); the route surface here is what the
// frontend talks to.

import crypto from 'node:crypto'
import express from 'express'
import {
  validRange, marginsSummary, productDetail, autopilotView, togglePlay,
  enableAllPending, revertLedger, setAutopilot, toggleGuardrail,
  costInputs, setCogs, alertsView, dismissAlert, toggleAlertRule,
} from './engine.js'
import { db, persist } from './db.js'
import * as oauth from './shopify-oauth.js'
import * as billing from './billing.js'
import { shopFromRequest } from './session.js'
import { syncFromShopify } from './sync.js'

const app = express()
// capture the raw body so webhook HMACs can be verified
app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf } }))

// permissive CORS for local dev (Vite on :5174 → API on :8787)
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*')
  res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.set('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

// resolve & validate ?range=, default 30d
const rangeOf = (req) => {
  const r = req.query.range || '30d'
  return validRange(r) ? r : '30d'
}
const send = (res, result) => {
  if (result && result.error === 'not_found') return res.status(404).json({ error: 'not_found' })
  if (result && result.error) return res.status(400).json({ error: result.error })
  res.json(result)
}

app.get('/api/health', (_req, res) => res.json({ ok: true, store: db.store.shop_domain, products: db.products.length }))
app.get('/api/store', (_req, res) => res.json({ ...db.store }))

// margins workspace
app.get('/api/margins', (req, res) => send(res, marginsSummary(rangeOf(req))))
app.get('/api/products', (req, res) => send(res, { products: marginsSummary(rangeOf(req)).products }))
app.get('/api/products/:id', (req, res) => send(res, productDetail(req.params.id, rangeOf(req))))

// cost inputs
app.get('/api/cost-inputs', (req, res) => send(res, costInputs(rangeOf(req))))
app.post('/api/cost-inputs/:id/cogs', (req, res) => send(res, setCogs(req.params.id, req.body?.cogsPerUnit, rangeOf(req))))

// autopilot
app.get('/api/autopilot', (req, res) => send(res, autopilotView(rangeOf(req))))
app.post('/api/autopilot', (req, res) => send(res, setAutopilot(req.body || {})))
app.post('/api/autopilot/plays/:id/toggle', (req, res) => send(res, togglePlay(req.params.id, rangeOf(req))))
app.post('/api/autopilot/plays/enable-all', (req, res) => send(res, enableAllPending(rangeOf(req))))
app.post('/api/autopilot/ledger/:id/revert', (req, res) => send(res, revertLedger(req.params.id)))
app.post('/api/autopilot/guardrails/:index/toggle', (req, res) => send(res, toggleGuardrail(Number(req.params.index))))

// alerts
app.get('/api/alerts', (_req, res) => send(res, alertsView()))
app.post('/api/alerts/:id/dismiss', (req, res) => send(res, dismissAlert(req.params.id)))
app.post('/api/alerts/rules/:index/toggle', (req, res) => send(res, toggleAlertRule(Number(req.params.index))))

// the reversible action log (trust surface)
app.get('/api/action-log', (_req, res) => res.json({ entries: db.actionLog }))

// Manually pull fresh data from the connected store. Works for a single store
// via env creds (SHOPIFY_SHOP/SHOPIFY_ADMIN_TOKEN — a custom app), or for an
// OAuth-installed shop (session token / ?shop=). Returns what was ingested.
app.post('/api/sync', async (req, res) => {
  const sess = shopFromRequest(req)
  const shop = sess?.shop || req.query.shop || process.env.SHOPIFY_SHOP
  const token = (shop && db.tokens[shop]) || process.env.SHOPIFY_ADMIN_TOKEN
  if (!shop || !token) return res.status(400).json({ error: 'no_shopify_credentials' })
  try {
    const creds = db.tokens[shop] ? { shop, token: db.tokens[shop] } : {} // {} → env fallback in shopify.js
    const result = await syncFromShopify(creds)
    db.store.shop_domain = shop
    res.json({ ok: true, shop, ...result })
  } catch (e) {
    console.warn('[sync] manual sync failed:', e.message)
    res.status(502).json({ error: 'sync_failed', message: e.message })
  }
})

// ============ Shopify OAuth (per-merchant install) ============
const oauthStates = new Set() // CSRF nonces (use a store/TTL cache in production)

// Start install: /auth?shop=foo.myshopify.com → redirect to Shopify consent.
app.get('/auth', (req, res) => {
  if (!oauth.isConfigured()) return res.status(503).send('Shopify app not configured (set SHOPIFY_API_KEY/SECRET).')
  const shop = req.query.shop
  if (!oauth.validShop(shop)) return res.status(400).send('Add ?shop=your-store.myshopify.com')
  const state = crypto.randomUUID()
  oauthStates.add(state)
  res.redirect(oauth.installUrl(shop, state))
})

// Consent callback: verify HMAC + state, exchange code, store token, sync.
app.get('/auth/callback', async (req, res) => {
  try {
    const { shop, code, state } = req.query
    if (!oauthStates.delete(state)) return res.status(403).send('bad state')
    if (!oauth.verifyCallbackHmac(req.query)) return res.status(403).send('bad hmac')
    const token = await oauth.exchangeToken(shop, code)
    db.tokens[shop] = token
    persist.shopToken(db, shop, token)
    await oauth.registerWebhooks(shop, token)
    await syncFromShopify({ shop, token }).catch((e) => console.warn('[auth] first sync failed:', e.message))
    res.send('Waterline connected ✓ — you can close this tab.')
  } catch (e) {
    console.warn('[auth] callback failed:', e.message)
    res.status(500).send('install failed')
  }
})

// ============ Billing (hybrid Autopilot+: $299/mo + 12% of recovered margin) ============
// Charges go on the merchant's Shopify invoice via the Billing API. Embedded
// requests carry an App Bridge session token; we verify it to learn the shop and
// look up its offline token. Inert without app credentials + an installed shop —
// the standalone UI uses the in-app toast fallback instead.

const billingShop = (req) => {
  const sess = shopFromRequest(req)
  const shop = sess?.shop || req.query.shop || req.body?.shop
  const token = shop ? db.tokens[shop] : null
  return { shop, token }
}

// Is the hybrid billing path live for this caller?
app.get('/api/billing/status', async (req, res) => {
  if (!oauth.isConfigured()) return res.json({ configured: false })
  const { shop, token } = billingShop(req)
  if (!shop || !token) return res.json({ configured: true, installed: false })
  try {
    const sub = await billing.getActiveSubscription(shop, token)
    res.json({ configured: true, installed: true, shop, subscription: sub })
  } catch (e) {
    res.json({ configured: true, installed: true, shop, error: e.message })
  }
})

// Start the Autopilot+ subscription → returns a confirmationUrl to redirect to.
app.post('/api/billing/subscribe', async (req, res) => {
  if (!oauth.isConfigured()) return res.status(503).json({ error: 'billing_not_configured' })
  const { shop, token } = billingShop(req)
  if (!shop || !token) return res.status(401).json({ error: 'shop_not_installed' })
  try {
    const { confirmationUrl, id } = await billing.subscribe(shop, token)
    res.json({ confirmationUrl, id })
  } catch (e) {
    console.warn('[billing] subscribe failed:', e.message)
    res.status(502).json({ error: 'subscribe_failed', message: e.message })
  }
})

// Shopify returns the merchant here after they approve (or decline) the charge.
app.get('/billing/callback', (req, res) => {
  const ok = req.query.charge_id || req.query.chargeId
  res.send(ok
    ? 'Autopilot+ is on ✓ — recovered margin is now billed at 12% on your Shopify invoice. You can close this tab.'
    : 'Autopilot+ was not approved. You can close this tab and try again anytime.')
})

// Webhooks: verify HMAC against the raw body, then re-sync that shop.
app.post('/webhooks', async (req, res) => {
  const ok = oauth.verifyWebhook(req.rawBody, req.get('X-Shopify-Hmac-Sha256'))
  if (!ok) return res.sendStatus(401)
  res.sendStatus(200) // ack fast; sync async
  const shop = req.get('X-Shopify-Shop-Domain')
  const token = db.tokens[shop]
  if (token) syncFromShopify({ shop, token }).catch((e) => console.warn('[webhook] sync failed:', e.message))
})

const port = process.env.PORT || 8787
app.listen(port, () => console.log(`Waterline API on http://localhost:${port}`))

// Single-store custom app: if env creds are present, pull live data on boot so
// the app shows the real store immediately (no manual /api/sync needed).
if (process.env.SHOPIFY_SHOP && process.env.SHOPIFY_ADMIN_TOKEN) {
  db.store.shop_domain = process.env.SHOPIFY_SHOP
  syncFromShopify({})
    .then((r) => console.log(`[boot] synced ${process.env.SHOPIFY_SHOP}: ${r.catalog} products, ${r.sold} with sales`))
    .catch((e) => console.warn('[boot] initial Shopify sync failed:', e.message))
}
