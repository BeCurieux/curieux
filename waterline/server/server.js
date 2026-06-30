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
