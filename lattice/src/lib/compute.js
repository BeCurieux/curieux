// Shared derivations for Lattice. The signature behavior — a bundle is gated by
// its WEAKEST component per warehouse — lives here so the frontend and the
// backend engine compute availability the same way (one source of truth).

<<<<<<< Updated upstream
import { COMPONENTS, BUNDLES, WAREHOUSES, INVENTORY_HERO } from './data.js'

export const componentById = (id) => COMPONENTS.find((c) => c.id === id)

const round2 = (n) => Math.round(n * 100) / 100

// Live pack summary for the builder: re-derived from the chosen quantities so a
// stepper change cascades to item count, subtotal, saving, pack price, and the
// subscribed price. `quantities` is an id→qty map (falls back to component qty).
export function packSummary(bundle, quantities = {}) {
  const ids = bundle.components || []
  let itemCount = 0
  let subtotal = 0
  for (const id of ids) {
    const c = componentById(id)
    if (!c) continue
    const qty = quantities[id] ?? c.qty ?? 1
    itemCount += qty
    subtotal += (c.price || 0) * qty
  }
  const saving = round2(subtotal * (bundle.savePct || 0))
  const price = round2(subtotal - saving)
  const subPrice = Math.round(price * (1 - (bundle.subDiscount || 0)))
  return { itemCount, subtotal: round2(subtotal), saving, price, subPrice }
}

=======
import { COMPONENTS, BUNDLES, WAREHOUSES } from './data.js'

export const componentById = (id) => COMPONENTS.find((c) => c.id === id)

>>>>>>> Stashed changes
// Per-component stock health in a warehouse.
export function stockHealth(stock, lowAt = 8) {
  if (stock <= 0) return 'out'
  if (stock <= lowAt) return 'low'
  return 'ok'
}

// How many complete bundles a warehouse can ship = min over components of
// floor(stock / qty). 0 in any component → the bundle is gated (hidden) there.
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

// The component that gates a bundle in a warehouse (the weakest link), or null.
export function gatingComponent(bundle, warehouseId) {
  const ids = bundle.components || []
  let weakest = null
  for (const cid of ids) {
    const c = componentById(cid)
    if (!c) continue
    const have = c.stock[warehouseId] ?? 0
    if (weakest == null || have < weakest.have) weakest = { component: c, have }
  }
  return weakest
}

// Region-gated availability for a bundle: which warehouses can ship it today.
export function bundleAvailability(bundle) {
  const regions = WAREHOUSES.filter((w) => w.id !== 'all')
  const perRegion = regions.map((w) => ({
    warehouse: w,
    shippable: shippableCount(bundle, w.id),
    blocked: shippableCount(bundle, w.id) <= 0,
  }))
  const anyBlocked = perRegion.some((r) => r.blocked)
  return { perRegion, anyBlocked, status: anyBlocked ? 'region-gated' : 'in_stock' }
}

<<<<<<< Updated upstream
// The inventory matrix rows: each component of the hero bundle with
// per-warehouse stock + derived bundle impact.
export function inventoryMatrix(heroId = INVENTORY_HERO) {
  const hero = BUNDLES.find((b) => b.id === heroId)
  const ids = hero?.components || []
  return ids.map(componentById).filter(Boolean).map((c) => {
=======
// The inventory matrix rows: each component with per-warehouse stock + impact.
export function inventoryMatrix() {
  return COMPONENTS.map((c) => {
>>>>>>> Stashed changes
    const out = Object.entries(c.stock).some(([, n]) => n <= 0)
    const low = Object.values(c.stock).some((n) => n > 0 && n <= (c.lowAt || 8))
    // which bundles does this component gate?
    const gates = BUNDLES.filter((b) => (b.components || []).includes(c.id) && bundleAvailability(b).anyBlocked)
    let impact = 'Healthy'
    let impactKind = 'muted'
    if (out) {
      const blockedRegion = WAREHOUSES.find((w) => w.id !== 'all' && (c.stock[w.id] ?? 0) <= 0)
      impact = blockedRegion ? `Hides ${blockedRegion.name === 'New York' ? 'NY' : blockedRegion.name} bundle` : 'Hides bundle'
      impactKind = 'warn'
    } else if (low) {
      impact = 'Low'
      impactKind = 'amber'
    }
    return { ...c, out, low, impact, impactKind, gatesCount: gates.length }
  })
}
