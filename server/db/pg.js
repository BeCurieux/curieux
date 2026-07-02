// Postgres persistence for the Waterline store. Two responsibilities:
//   hydrate(db)  — load saved mutable state into the in-memory `db` on boot
//   persist.*    — write-through each mutation (fire-and-forget)
//
// Entirely inert when DATABASE_URL is unset: hydrate is a no-op and every
// persist.* call returns immediately, so the app runs purely in-memory (seed /
// snapshot) with no database. Errors are caught and logged, never thrown, so a
// flaky DB can't take the API down — the in-memory store stays authoritative.

import pg from 'pg'

const URL = process.env.DATABASE_URL
export const isEnabled = () => !!URL

let pool = null
const getPool = () => {
  if (!pool) pool = new pg.Pool({ connectionString: URL, ssl: URL && /supabase|render|amazonaws/.test(URL) ? { rejectUnauthorized: false } : undefined })
  return pool
}

async function q(text, params = []) {
  try {
    return await getPool().query(text, params)
  } catch (e) {
    console.warn('[pg] query failed (continuing in-memory):', e.message)
    return { rows: [] }
  }
}

// Load saved mutable state into the in-memory db for the active store.
export async function hydrate(db) {
  if (!isEnabled()) return
  const sid = db.store.id
  await q(
    `insert into stores (id, shop_domain, name, currency, fee_rate, autopilot_on, autopilot_mode)
     values ($1,$2,$3,$4,$5,$6,$7) on conflict (id) do nothing`,
    [sid, db.store.shop_domain, db.store.name, db.store.currency, db.store.fee_rate, db.store.autopilot_on, db.store.autopilot_mode],
  )

  const store = (await q('select autopilot_on, autopilot_mode from stores where id=$1', [sid])).rows[0]
  if (store) { db.store.autopilot_on = store.autopilot_on; db.store.autopilot_mode = store.autopilot_mode }

  for (const r of (await q('select product_id, cogs_per_unit from cogs_overrides where store_id=$1', [sid])).rows) {
    db.cogsOverride[r.product_id] = Number(r.cogs_per_unit)
    if (db.cogsConf) db.cogsConf[r.product_id] = 'verified'
  }
  for (const r of (await q('select play_id, state from play_state where store_id=$1', [sid])).rows) {
    if (r.state === 'enabled') db.enabled[r.play_id] = true
    else if (r.state === 'paused') db.paused[r.play_id] = true
  }
  for (const r of (await q('select idx, enabled from guardrails where store_id=$1', [sid])).rows) {
    if (db.guardrails[r.idx]) db.guardrails[r.idx].on = r.enabled
  }
  for (const r of (await q('select id from alerts where store_id=$1 and dismissed_at is not null', [sid])).rows) {
    db.dismissedAlerts[r.id] = true
  }
  const led = (await q('select * from ledger where store_id=$1 order by created_at desc', [sid])).rows
  if (led.length) {
    db.ledger = led.map((l) => ({ id: l.id, pid: l.product_id, type: l.type, action: l.action, when: 'saved', before: Number(l.before_margin), after: Number(l.after_margin), recovered: Number(l.recovered), series: l.series_json || [], note: l.note }))
    led.filter((l) => l.reverted_at).forEach((l) => { db.reverted[l.id] = true })
  }
  const prods = (await q('select * from products where store_id=$1', [sid])).rows
  if (prods.length) {
    db.products = prods.map((p) => ({ id: p.id, shopifyId: p.shopify_id, name: p.title, short: p.short, cat: p.category, catColor: p.cat_color, price: Number(p.price), units: p.units, cogsPerUnit: p.cogs_per_unit != null ? Number(p.cogs_per_unit) : null, cogs: Number(p.cogs), ship: Number(p.ship), fees: Number(p.fees), ads: Number(p.ads), disc: Number(p.disc), ret: Number(p.ret) }))
    db.cogsConf = Object.fromEntries(prods.map((p) => [p.id, p.cogs_confidence || 'estimated']))
  }
  const tok = (await q('select shop, access_token from shop_tokens where store_id=$1', [sid])).rows
  tok.forEach((t) => { db.tokens[t.shop] = t.access_token })
  const spend = (await q('select * from ad_spend where store_id=$1', [sid])).rows
  if (spend.length) db.adSpend = spend.map((s) => ({ id: s.id, platform: s.platform, campaign: s.campaign, spend: Number(s.spend), attributedRevenue: Number(s.attributed_revenue), productId: s.product_id }))
  const log = (await q('select * from action_log where store_id=$1 order by executed_at desc limit 200', [sid])).rows
  if (log.length) db.actionLog = log.map((a) => ({ id: a.id, play_id: a.play_id, kind: a.kind, executed_at: a.executed_at, prior_value_json: a.prior_value_json, new_value_json: a.new_value_json, reverted_at: a.reverted_at }))
  console.log(`[pg] hydrated store ${sid}`)
}

const sid = (db) => db.store.id

// Write-through persisters — all no-ops without a DB.
export const persist = {
  cogsOverride: (db, productId, value) => isEnabled() && q(
    `insert into cogs_overrides (store_id, product_id, cogs_per_unit) values ($1,$2,$3)
     on conflict (store_id, product_id) do update set cogs_per_unit=excluded.cogs_per_unit, updated_at=now()`,
    [sid(db), productId, value]),

  playState: (db, playId, state) => isEnabled() && (state
    ? q(`insert into play_state (store_id, play_id, state) values ($1,$2,$3)
         on conflict (store_id, play_id) do update set state=excluded.state, updated_at=now()`, [sid(db), playId, state])
    : q('delete from play_state where store_id=$1 and play_id=$2', [sid(db), playId])),

  guardrail: (db, idx, on) => isEnabled() && q(
    `insert into guardrails (store_id, idx, label, enabled) values ($1,$2,$3,$4)
     on conflict (store_id, idx) do update set enabled=excluded.enabled`,
    [sid(db), idx, db.guardrails[idx]?.label, on]),

  alertRule: (db, idx, on) => isEnabled() && q(
    `insert into alert_rules (store_id, rule_key, enabled) values ($1,$2,$3)
     on conflict (store_id, rule_key) do update set enabled=excluded.enabled`,
    [sid(db), String(idx), on]),

  dismissAlert: (db, id) => isEnabled() && q('update alerts set dismissed_at=now() where store_id=$1 and id=$2', [sid(db), id]),

  autopilot: (db) => isEnabled() && q('update stores set autopilot_on=$2, autopilot_mode=$3 where id=$1', [sid(db), db.store.autopilot_on, db.store.autopilot_mode]),

  actionLog: (db, row) => isEnabled() && q(
    `insert into action_log (id, store_id, play_id, kind, prior_value_json, new_value_json, executed_at)
     values ($1,$2,$3,$4,$5,$6,$7)`,
    [row.id, sid(db), row.play_id, row.kind, row.prior_value_json, row.new_value_json, row.executed_at]),

  ledgerOpen: (db, l) => isEnabled() && q(
    `insert into ledger (id, store_id, play_id, product_id, type, action, before_margin, after_margin, recovered, series_json, note)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) on conflict (id) do nothing`,
    [l.id, sid(db), l.id.replace(/^led_/, ''), l.pid, l.type, l.action, l.before, l.after, l.recovered, JSON.stringify(l.series), l.note]),

  ledgerClose: (db, id) => isEnabled() && q('delete from ledger where store_id=$1 and id=$2', [sid(db), id]),

  ledgerReverted: (db, id, reverted) => isEnabled() && q('update ledger set reverted_at=$3 where store_id=$1 and id=$2', [sid(db), id, reverted ? new Date().toISOString() : null]),

  // Replace the catalog after a Shopify sync.
  products: async (db, products) => {
    if (!isEnabled()) return
    await q('delete from products where store_id=$1', [sid(db)])
    for (const p of products) {
      await q(
        `insert into products (store_id, id, shopify_id, title, short, category, cat_color, price, units, cogs_per_unit, cogs, ship, fees, ads, disc, ret, cogs_confidence)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [sid(db), p.id, p.shopifyId, p.name, p.short, p.cat, p.catColor, p.price, p.units, p.cogsPerUnit, p.cogs, p.ship, p.fees, p.ads, p.disc, p.ret, p.cogsPerUnit != null ? 'verified' : 'missing'],
      )
    }
  },

  shopToken: (db, shop, token) => isEnabled() && q(
    `insert into shop_tokens (shop, store_id, access_token, installed_at) values ($1,$2,$3,now())
     on conflict (shop) do update set access_token=excluded.access_token, installed_at=now()`,
    [shop, sid(db), token]),
}
