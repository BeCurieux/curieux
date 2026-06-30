// In-memory data store for the Waterline backend skeleton.
//
// Seeded from the same sample data the frontend uses (src/lib/data.js) so there
// is ONE source of truth. In production this module is replaced by a real
// database matching the schema in BUILD_SPEC.md §9 (stores, products, ad_spend,
// margins, plays, action_log, ledger, alerts, alert_rules). The shape of the
// exported `db` object mirrors those tables.

import {
  BASE, PLAYS, LEDGER, BASE_ACTIVITY, GUARDRAILS,
  SOURCES, COGS_CONF, ALERT_FEED, ALERT_RULES,
} from '../src/lib/data.js'
import { loadSnapshot } from './shopify.js'
import { hydrate, persist } from './db/pg.js'

// WATERLINE_DATA=shopify → serve real ingested data from shopify-snapshot.json.
// Anything else → the "Harbor & Vine" seed (lets the prototype run with no store).
const MODE = process.env.WATERLINE_DATA === 'shopify' ? 'shopify' : 'seed'

function seedDb() {
  return {
    store: { id: 'harbor-vine', shop_domain: 'harborandvine.com', name: 'Harbor & Vine', currency: 'USD', fee_rate: 0.029, autopilot_on: true, autopilot_mode: 'guarded' },
    products: BASE.map((p) => ({ ...p })),
    cogsConf: { ...COGS_CONF },
    plays: PLAYS.map((p) => ({ ...p })),
    ledger: LEDGER.map((l) => ({ ...l })),
    activity: [...BASE_ACTIVITY],
    alerts: ALERT_FEED.map((a) => ({ ...a })),
    sources: SOURCES.map((s) => ({ ...s })),
  }
}

// Real Shopify data. Autopilot plays/ledger/alerts start empty — they're generated
// from real signals (ad attribution, return reasons, etc.), which is the next phase.
function shopifyDb() {
  const snap = loadSnapshot()
  const sources = [
    { id: 'shopify', name: 'Shopify', detail: `Orders, products, COGS · ${snap.catalog} products`, status: 'live', icon: 'S', color: '#95BF47' },
    { id: 'meta', name: 'Meta Ads', detail: 'Not connected — ad spend unattributed', status: 'off', icon: 'M', color: '#0866FF' },
    { id: 'google', name: 'Google Ads', detail: 'Not connected — ad spend unattributed', status: 'off', icon: 'G', color: '#EA4335' },
  ]
  return {
    store: { id: snap.store.id, shop_domain: snap.store.shop_domain, name: snap.store.name, currency: snap.store.currency, fee_rate: snap.store.fee_rate, autopilot_on: false, autopilot_mode: 'ask' },
    products: snap.products.map((p) => ({ ...p })),
    cogsConf: Object.fromEntries(snap.products.map((p) => [p.id, 'verified'])), // real Shopify cost = verified
    plays: [],
    ledger: [],
    activity: [],
    alerts: [],
    sources,
  }
}

const seeded = MODE === 'shopify' ? shopifyDb() : seedDb()

export const db = {
  ...seeded,
  mode: MODE,
  cogsOverride: {},               // id -> merchant-confirmed per-unit cost (flips conf to verified)
  enabled: {},                    // play id -> true (suggested/approval plays the user turned on)
  paused: {},                     // play id -> true (running plays the user paused)
  reverted: {},                   // ledger id -> true
  dismissedAlerts: {},
  guardrails: GUARDRAILS.map((g) => ({ ...g })), // policy applies in both modes
  alertRules: ALERT_RULES.map((r) => ({ ...r })),
  // ad_spend records from connectors (Meta/Google) — empty until one is wired.
  // When present, the engine attributes them per product (BUILD_SPEC §4). Seed
  // mode leaves this empty because its `ads` are already baked into the totals.
  adSpend: [],
  orders: {},      // ordersById, for order-level attribution fallback
  handleToId: {},  // product handle -> id, for UTM attribution
  // action_log — written BEFORE every mutation, prior value captured for revert.
  actionLog: [],
}

let _seq = 1
export const nextId = (prefix) => `${prefix}_${_seq++}`

// Record an action before it mutates state. Returns the row so callers can set
// new_value / reverted_at later.
export function logAction({ playId = null, kind, prior = null, next = null }) {
  const row = {
    id: nextId('act'),
    play_id: playId,
    kind,
    executed_at: new Date().toISOString(),
    prior_value_json: prior,
    new_value_json: next,
    reverted_at: null,
  }
  db.actionLog.unshift(row)
  persist.actionLog(db, row) // write-through (no-op without DATABASE_URL)
  return row
}

// Hydrate saved state from Postgres on boot (no-op without DATABASE_URL).
// Top-level await: importers (engine, server) resolve only after hydration.
export { persist }
await hydrate(db)
