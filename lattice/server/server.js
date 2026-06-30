// Lattice backend skeleton — REST API over the in-memory store + engine.
//
// Run: npm run server   (defaults to port 8788)
// Read views for every screen + a few mutations (warehouse routing, component
// stock, feed re-sync), each writing a reversible action log. Real Shopify
// Admin GraphQL ingestion + OAuth and your feed/analytics services are the next
// phase; the route surface here is what the frontend talks to.

import express from 'express'
import { db } from './db.js'
import {
  storeView, homeView, bundlesView, bundleDetail, feedsView, resyncFeeds,
  subscriptionsView, inventoryView, setRouting, setStock,
  performanceView, analyticsView,
} from './engine.js'

const app = express()
app.use(express.json())

// permissive CORS for local dev (Vite on :5175 → API on :8788)
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*')
  res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.set('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

const send = (res, result) => {
  if (result && result.error === 'not_found') return res.status(404).json({ error: 'not_found' })
  if (result && result.error) return res.status(400).json({ error: result.error })
  res.json(result)
}

app.get('/api/health', (_req, res) => res.json({ ok: true, store: db.store.domain, bundles: db.bundles.length }))
app.get('/api/store', (_req, res) => res.json(storeView()))

// screens
app.get('/api/home', (_req, res) => send(res, homeView()))
app.get('/api/bundles', (_req, res) => send(res, bundlesView()))
app.get('/api/bundles/:id', (req, res) => send(res, bundleDetail(req.params.id)))

app.get('/api/feeds', (_req, res) => send(res, feedsView()))
app.post('/api/feeds/resync', (_req, res) => send(res, resyncFeeds()))

app.get('/api/subscriptions', (_req, res) => send(res, subscriptionsView()))

app.get('/api/inventory', (_req, res) => send(res, inventoryView()))
app.post('/api/inventory/routing', (req, res) => send(res, setRouting(req.body?.on)))
app.post('/api/inventory/:id/stock', (req, res) => send(res, setStock(req.params.id, req.body?.warehouseId, req.body?.qty)))

app.get('/api/performance', (_req, res) => send(res, performanceView()))
app.get('/api/analytics', (_req, res) => send(res, analyticsView()))

// the reversible action log (trust surface)
app.get('/api/action-log', (_req, res) => res.json({ entries: db.actionLog }))

const port = process.env.PORT || 8788
app.listen(port, () => console.log(`Lattice API on http://localhost:${port}`))
