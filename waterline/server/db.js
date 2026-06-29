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

// A single fictional store. fee_rate + autopilot config live here per the spec.
export const db = {
  store: {
    id: 'harbor-vine',
    shop_domain: 'harborandvine.com',
    fee_rate: 0.029, // 2.9% + $0.30/txn (the per-txn part is folded into seed `fees`)
    autopilot_on: true,
    autopilot_mode: 'guarded', // 'guarded' | 'ask'
  },

  products: BASE.map((p) => ({ ...p })),
  cogsConf: { ...COGS_CONF },     // id -> 'verified' | 'estimated' | 'missing'
  cogsOverride: {},               // id -> merchant-confirmed per-unit cost (flips conf to verified)

  plays: PLAYS.map((p) => ({ ...p })),
  enabled: {},                    // play id -> true (suggested/approval plays the user turned on)
  paused: {},                     // play id -> true (running plays the user paused)

  ledger: LEDGER.map((l) => ({ ...l })),
  reverted: {},                   // ledger id -> true

  activity: [...BASE_ACTIVITY],   // most-recent-first feed; mutations prepend

  guardrails: GUARDRAILS.map((g) => ({ ...g })),
  alertRules: ALERT_RULES.map((r) => ({ ...r })),
  alerts: ALERT_FEED.map((a) => ({ ...a })),
  dismissedAlerts: {},

  sources: SOURCES.map((s) => ({ ...s })),

  // action_log — written BEFORE every mutation, with the prior value captured so
  // any action is reversible (BUILD_SPEC.md §6). Append-only.
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
  return row
}
