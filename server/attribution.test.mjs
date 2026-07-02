// Run: node server/attribution.test.mjs
// Proves the three attribution tiers (feed / UTM / order-level fallback),
// ROAS, and confidence degradation. Uses fixtures incl. the real order #1001.

import assert from 'node:assert'
import { attribute, applyAttribution, handleFromUrl, METHOD } from './attribution.js'

let pass = 0
const ok = (name, cond) => { assert.ok(cond, name); console.log('  ✓', name); pass++ }

// --- handle parsing ---
ok('parses product handle from landing URL', handleFromUrl('https://shop.com/products/merino-tee?utm_source=meta') === 'merino-tee')
ok('returns null when no product in URL', handleFromUrl('https://shop.com/collections/all') === null)

// --- fixtures ---
const products = [
  { id: 'sweatshirt', handle: 'mamacita-signature-sweatshirt' },
  { id: 'mug', handle: 'classic-mamacita-mug' },
  { id: 'tote', handle: 'eco-tote' },
]
// order #1001-style: one order with two products by revenue (for fallback split).
// Uses sweatshirt + tote so the mug stays UTM-only (to assert medium confidence).
const ordersById = {
  '1001': { lines: [{ productId: 'sweatshirt', revenue: 119 }, { productId: 'tote', revenue: 13.5 }] },
}

const adRecords = [
  // 1. FEED match — ad tied directly to a product id
  { id: 'm1', platform: 'meta', campaign: 'Catalog', spend: 100, productId: 'sweatshirt', attributedRevenue: 300 },
  // 2. UTM match — landing URL → handle
  { id: 'g1', platform: 'google', campaign: 'Search', spend: 40, landingUrl: 'https://shop.com/products/classic-mamacita-mug?utm_medium=cpc', attributedRevenue: 80 },
  // 3. ORDER fallback — campaign spend split across the order's products by revenue
  { id: 'm2', platform: 'meta', campaign: 'Prospecting', spend: 66.25, orderIds: ['1001'], attributedRevenue: 132.5 },
  // unattributable — no product, no URL, no orders
  { id: 'x1', platform: 'meta', campaign: 'Brand', spend: 25 },
]

const { byProduct, unattributed } = attribute(adRecords, { products, ordersById })

// feed
ok('feed: spend attributed directly', byProduct.sweatshirt.spend === 100 + 66.25 * (119 / 132.5))
ok('feed: ROAS computed', byProduct.mug.roas > 0)

// utm — mug attributed only via landing URL → medium confidence
ok('utm: mug gets the search spend', byProduct.mug.spend === 40)
ok('utm: mug confidence is medium (utm only)', byProduct.mug.confidence === 'medium')

// order-level fallback split by revenue (119 : 13.5)
const swOrderShare = 66.25 * (119 / 132.5)
const toteOrderShare = 66.25 * (13.5 / 132.5)
ok('fallback: sweatshirt got revenue-weighted share', Math.abs((byProduct.sweatshirt.spend - 100) - swOrderShare) < 0.01)
ok('fallback: tote got its revenue-weighted share', Math.abs(byProduct.tote.spend - toteOrderShare) < 0.01)

// confidence: sweatshirt touched by feed + order → worst (order) wins → low
ok('confidence: worst method wins (sweatshirt low)', byProduct.sweatshirt.confidence === 'low')

// unattributed spend tracked, not silently dropped
ok('unattributed brand spend tracked', unattributed === 25)

// applyAttribution maps onto product rows
const rows = applyAttribution([{ id: 'sweatshirt', ads: 0, rev: 119 }, { id: 'journal', ads: 0, rev: 0 }], { byProduct })
ok('applyAttribution sets ads on matched product', rows[0].ads === byProduct.sweatshirt.spend)
ok('applyAttribution leaves unmatched product at ads 0', rows[1].ads === 0 && rows[1].roas === null)

console.log(`\n${pass} assertions passed.`)
