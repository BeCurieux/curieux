// In-memory data store for the Lattice backend skeleton.
//
// Seeded from the same sample data the frontend uses (src/lib/data.js) so there
// is ONE source of truth. In production this module is replaced by a real
// database; bundle/component/inventory/feed/subscription state would be hydrated
// from Shopify Admin GraphQL (products, variants, inventory levels, selling
// plans) + your own feed/analytics services. The shape of the exported `db`
// object mirrors those resources.

import {
  STORE, WAREHOUSES, COMPONENTS, BUNDLES, HOME_KPIS, HOME_ATTENTION,
  CHANNELS, FEED_SCHEMA, SYNC_LOG, SUBS_KPIS, RENEWALS, SELLING_PLANS,
  PERF_SCORE, PERF_METRICS, PERF_COMPARISON, ANALYTICS_KPIS, REVENUE_BY_WEEK, TOP_BUNDLES,
} from '../src/lib/data.js'

export const db = {
  store: { ...STORE },
  warehouses: WAREHOUSES.map((w) => ({ ...w })),
  // components carry mutable per-warehouse stock — the inventory engine derives
  // weakest-link bundle availability from this.
  components: COMPONENTS.map((c) => ({ ...c, stock: { ...c.stock } })),
  bundles: BUNDLES.map((b) => ({ ...b })),

  homeKpis: HOME_KPIS,
  homeAttention: HOME_ATTENTION,

  channels: CHANNELS.map((c) => ({ ...c })),
  feedSchema: FEED_SCHEMA,
  syncLog: SYNC_LOG.map((s) => ({ ...s })),

  subsKpis: SUBS_KPIS,
  renewals: RENEWALS,
  sellingPlans: SELLING_PLANS,

  performance: { score: PERF_SCORE, metrics: PERF_METRICS, comparison: PERF_COMPARISON },
  analytics: { kpis: ANALYTICS_KPIS, revenueByWeek: REVENUE_BY_WEEK, topBundles: TOP_BUNDLES },

  // settings
  routingOn: true, // fulfillment warehouse routing (region gating)

  // action_log — written before every mutation, prior value captured for revert.
  actionLog: [],
}

let _seq = 1
export const nextId = (prefix) => `${prefix}_${_seq++}`

// Record an action before it mutates state. Returns the row.
export function logAction({ kind, prior = null, next = null }) {
  const row = {
    id: nextId('act'),
    kind,
    executed_at: new Date().toISOString(),
    prior_value_json: prior,
    new_value_json: next,
  }
  db.actionLog.unshift(row)
  return row
}
