// Lattice margin/inventory/feed engine. Read views + mutations over the
// in-memory store. The signature rule — a bundle is gated by its WEAKEST
// component per warehouse — is implemented here against the mutable `db`
// (mirroring src/lib/compute.js, which the frontend uses on static data).

import { db, logAction } from './db.js'

const componentById = (id) => db.components.find((c) => c.id === id)
const regions = () => db.warehouses.filter((w) => w.id !== 'all')

// How many complete bundles a warehouse can ship = min over components of
// floor(stock / qty). 0 in any component → the bundle is gated there.
export function shippableCount(bundle, warehouseId) {
  const ids = bundle.components || []
  if (!ids.length) return Infinity
  return ids.reduce((min, cid) => {
    const c = componentById(cid)
    if (!c) return min
    const have = Math.floor((c.stock[warehouseId] ?? 0) / (c.qty || 1))
    return Math.min(min, have)
  }, Infinity)
}

export function bundleAvailability(bundle) {
  const perRegion = regions().map((w) => {
    const count = shippableCount(bundle, w.id)
    return { warehouse: w, count, blocked: count <= 0 }
  })
  // Region gating only hides bundles when routing is on.
  const anyBlocked = db.routingOn && perRegion.some((r) => r.blocked)
  return { perRegion, anyBlocked, status: anyBlocked ? 'region-gated' : 'in_stock' }
}

// ---- read views ----

export const storeView = () => ({ ...db.store })

export const homeView = () => ({
  store: db.store,
  kpis: db.homeKpis,
  attention: db.homeAttention,
  bundles: db.bundles.map((b) => ({ id: b.id, code: b.code, tile: b.tile, name: b.name, itemCount: b.itemCount, type: b.type, price: b.price, attach: b.attach, status: b.status, statusKind: b.statusKind })),
})

export const bundlesView = () => ({
  bundles: db.bundles.map((b) => ({ ...b, availability: bundleAvailability(b) })),
  components: db.components,
})

export const bundleDetail = (id) => {
  const b = db.bundles.find((x) => x.id === id)
  if (!b) return { error: 'not_found' }
  const components = (b.components || []).map((cid) => componentById(cid)).filter(Boolean)
  return { ...b, components, availability: bundleAvailability(b) }
}

export const feedsView = () => ({
  channels: db.channels,
  schema: db.feedSchema,
  log: db.syncLog,
})

export const subscriptionsView = () => ({
  kpis: db.subsKpis,
  renewals: db.renewals,
  plans: db.sellingPlans,
})

// Inventory matrix: each component with per-warehouse stock + derived impact.
export const inventoryView = () => {
  const matrix = db.components.map((c) => {
    const out = Object.values(c.stock).some((n) => n <= 0)
    const low = Object.values(c.stock).some((n) => n > 0 && n <= (c.lowAt || 8))
    let impact = 'Healthy', impactKind = 'muted'
    if (out) {
      const blockedRegion = regions().find((w) => (c.stock[w.id] ?? 0) <= 0)
      impact = blockedRegion ? `Hides ${blockedRegion.name === 'New York' ? 'NY' : blockedRegion.name} bundle` : 'Hides bundle'
      impactKind = 'warn'
    } else if (low) { impact = 'Low'; impactKind = 'amber' }
    return { ...c, out, low, impact, impactKind }
  })
  const hero = db.bundles.find((b) => b.id === 'summer')
  const results = bundleAvailability(hero).perRegion
  return { warehouses: db.warehouses, routingOn: db.routingOn, matrix, results }
}

export const performanceView = () => ({ ...db.performance })
export const analyticsView = () => ({ ...db.analytics })

// ---- mutations ----

export function setRouting(on) {
  const next = !!on
  logAction({ kind: 'routing.set', prior: { on: db.routingOn }, next: { on: next } })
  db.routingOn = next
  return inventoryView()
}

export function setStock(componentId, warehouseId, qty) {
  const c = componentById(componentId)
  if (!c) return { error: 'not_found' }
  if (!db.warehouses.some((w) => w.id === warehouseId) || warehouseId === 'all') return { error: 'bad_warehouse' }
  const n = Number(qty)
  if (!Number.isFinite(n) || n < 0) return { error: 'bad_qty' }
  logAction({ kind: 'stock.set', prior: { id: componentId, warehouseId, qty: c.stock[warehouseId] }, next: { id: componentId, warehouseId, qty: n } })
  c.stock[warehouseId] = n
  return inventoryView()
}

// Re-sync feeds: stamp the channels as freshly synced (in production this calls
// the Meta/Google/Pinterest feed APIs and re-validates the parent catalog).
export function resyncFeeds() {
  logAction({ kind: 'feeds.resync', prior: null, next: { at: new Date().toISOString() } })
  db.channels = db.channels.map((c) => ({ ...c, lastSync: 'just now', errors: 0, valid: true }))
  db.syncLog = [{ dot: 'good', title: 'Manual re-sync', meta: 'just now · all channels pushed · 0 errors' }, ...db.syncLog]
  return feedsView()
}
