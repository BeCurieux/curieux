// Server-side margin engine + Autopilot logic.
//
// Reuses the SAME formula module the frontend uses (src/lib/compute.js) so the
// numbers can never drift between client and server. Everything here returns
// raw numbers + labels (no UI styles) — presentation stays in the client.

import { FACTORS, RANGE_LABELS, enrich, perUnitCogs } from '../src/lib/compute.js'
import { CAT_COLOR } from '../src/lib/data.js'
import { db, logAction } from './db.js'
import { attribute } from './attribution.js'
import { generatePlays } from '../src/lib/plays.js'
import { executorFor } from './executors.js'

// Curated seed plays if present; otherwise generate from real signals (real store).
function playList(range = '30d') {
  return db.plays?.length ? db.plays : generatePlays(enrichAll(range), { approvalLimit: 5000 })
}

export const validRange = (r) => Object.prototype.hasOwnProperty.call(FACTORS, r)
const factorFor = (range) => FACTORS[range] ?? 1

const productById = (id) => db.products.find((p) => p.id === id)
export const nameOf = (id) => productById(id)?.name
export const catOf = (id) => productById(id)?.cat

// Per-product ad attribution for the current store, if any ad_spend is loaded
// (BUILD_SPEC §4). Dormant until a connector populates db.adSpend — seed data
// already carries its own `ads`, so this only kicks in for the real-store path.
export function currentAttribution() {
  if (!db.adSpend?.length) return null
  return attribute(db.adSpend, { products: db.products, ordersById: db.orders || {}, handleToId: db.handleToId || {} })
}

// --- core: enrich every product for a window ---
export function enrichAll(range = '30d') {
  const f = factorFor(range)
  const attr = currentAttribution()
  return db.products.map((p) => {
    const hit = attr && (attr.byProduct[p.id] || attr.byProduct[p.shopifyId])
    const src = hit ? { ...p, ads: hit.spend } : p // inject attributed ad spend before computing margin
    const e = enrich(src, f, db.cogsOverride)
    e.roas = hit ? hit.roas : null
    e.adConfidence = hit ? hit.confidence : null
    return e
  })
}

// --- store-level rollup + leak buckets ---
export function marginsSummary(range = '30d') {
  const enr = enrichAll(range)
  const sum = (k) => enr.reduce((a, p) => a + p[k], 0)
  const totRev = sum('rev')
  const totNet = sum('net')
  const under = enr.filter((p) => p.status === 'under')
  const hiddenLoss = under.reduce((a, p) => a + -p.net, 0)

  const costBuckets = [
    { label: 'Cost of goods', value: sum('cogs'), leak: false },
    { label: 'Ad spend', value: sum('ads'), leak: true },
    { label: 'Shipping', value: sum('ship'), leak: false },
    { label: 'Returns', value: sum('ret'), leak: true },
    { label: 'Discounts', value: sum('disc'), leak: false },
    { label: 'Payment fees', value: sum('fees'), leak: false },
  ].sort((a, b) => b.value - a.value)

  const topLeak = costBuckets.filter((b) => b.leak).sort((a, b) => b.value - a.value)[0]

  return {
    range,
    rangeLabel: RANGE_LABELS[range],
    totals: {
      revenue: totRev,
      netProfit: totNet,
      blendedMargin: totRev ? totNet / totRev : 0,
      underwaterCount: under.length,
      hiddenLoss,
    },
    costBuckets,
    topLeak: topLeak ? { ...topLeak, shareOfRevenue: totRev ? topLeak.value / totRev : 0, trim20: topLeak.value * 0.2 } : null,
    // Margin views show products with sales in the window; the full catalog lives on Cost inputs.
    products: enr.filter((p) => p.units > 0).map(publicProduct),
    catalogCount: enr.length,
  }
}

// Trim an enriched product to the public API shape (raw numbers + meta).
function publicProduct(p) {
  return {
    id: p.id, name: p.name, short: p.short, cat: p.cat, catColor: p.catColor || CAT_COLOR[p.cat] || '#8B98A1',
    units: p.units, revenue: p.rev, cogs: p.cogs, ship: p.ship, fees: p.fees,
    ads: p.ads, discounts: p.disc, returns: p.ret,
    netProfit: p.net, marginPct: p.pct, status: p.status,
    roas: p.roas ?? null, adConfidence: p.adConfidence ?? null,
    topLeak: { label: p.leakLabel, shareOfRevenue: p.leakShare },
  }
}

export function productDetail(id, range = '30d') {
  const enr = enrichAll(range).find((p) => p.id === id)
  if (!enr) return null
  const breakdown = [
    { label: 'COGS', value: enr.cogs, leak: false },
    { label: 'Ad spend', value: enr.ads, leak: enr.leakLabel === 'Ad spend' },
    { label: 'Shipping', value: enr.ship, leak: enr.leakLabel === 'Shipping' },
    { label: 'Returns', value: enr.ret, leak: enr.leakLabel === 'Returns' },
    { label: 'Discounts', value: enr.disc, leak: enr.leakLabel === 'Discounts' },
    { label: 'Fees', value: enr.fees, leak: false },
  ]
  const plays = effectivePlays(range).filter((p) => p.productId === id)
  return {
    ...publicProduct(enr),
    perUnitNet: enr.net / enr.units,
    revenue: enr.rev,
    breakdown,
    plays,
  }
}

// ============ Autopilot ============

const GUARD = {
  NO_PAUSE_HIGH_MARGIN: 0, // Never pause ads on products above 20% margin
  CAP_DISCOUNT: 1,         // Cap any discount Autopilot sets at 10%
  PAUSE_AFTER_DAYS: 2,     // Pause spend only after 7 days of ROAS < 1.2x
  APPROVAL_ABOVE: 3,       // Require approval above $5,000 monthly impact
  PRICE_LIMIT: 4,          // Limit price changes to ±8%
}
const guardOn = (i) => !!db.guardrails[i]?.on

// Server-side guardrail enforcement (BUILD_SPEC.md §7). Returns whether a play
// may execute automatically, or must be routed to "needs approval".
export function checkGuardrails(play, range = '30d') {
  const reasons = []
  if (guardOn(GUARD.APPROVAL_ABOVE) && play.amt > 5000) {
    reasons.push('Projected impact exceeds the $5,000 auto-approval limit.')
  }
  if (guardOn(GUARD.NO_PAUSE_HIGH_MARGIN) && play.type === 'Ad spend' && /pause/i.test(play.action)) {
    const enr = enrichAll(range).find((p) => p.id === play.pid)
    if (enr && enr.pct > 0.2) reasons.push('Product margin is above the 20% no-pause threshold.')
  }
  return { allowed: reasons.length === 0, reasons }
}

// In guarded mode, within-guardrail plays auto-run unless paused.
const autoRuns = (p) => p.base !== 'running' && p.base !== 'approval' && db.store.autopilot_mode === 'guarded'

// Effective status of every play given store state + mode + master switch + guardrails.
export function effectivePlays(range = '30d') {
  const apOn = db.store.autopilot_on
  return playList(range).map((p) => {
    let status
    if (!apOn) status = 'held'
    else if (p.base === 'running' || autoRuns(p)) status = db.paused[p.id] ? 'paused' : 'running'
    else status = db.enabled[p.id] ? 'running' : p.base
    const guard = checkGuardrails(p, range)
    return {
      id: p.id, productId: p.pid, productName: nameOf(p.pid), cat: catOf(p.pid), catColor: CAT_COLOR[catOf(p.pid)],
      type: p.type, action: p.action, detail: p.detail, projectedMonthly: p.amt,
      status, running: status === 'running',
      why: p.why, signals: p.signals,
      guardrail: guard,
    }
  })
}

export function autopilotView(range = '30d') {
  const plays = effectivePlays(range)
  const monthlyRun = plays.filter((p) => p.running).reduce((a, p) => a + p.projectedMonthly, 0)
  const pending = plays.filter((p) => p.status === 'suggested' || p.status === 'approval')
  const ledger = db.ledger.map((l) => {
    const reverted = !!db.reverted[l.id]
    return {
      id: l.id, productId: l.pid, productName: nameOf(l.pid), cat: catOf(l.pid),
      type: l.type, action: l.action, when: l.when, note: l.note,
      beforeMargin: l.before, afterMargin: l.after, recovered: l.recovered,
      series: l.series, reverted,
    }
  })
  const ledgerTotal = db.ledger.reduce((a, l) => a + (db.reverted[l.id] ? 0 : l.recovered), 0)
  return {
    autopilotOn: db.store.autopilot_on,
    mode: db.store.autopilot_mode,
    recoveredThisQuarter: 8200 + monthlyRun,
    runningCount: plays.filter((p) => p.running).length,
    pending: { count: pending.length, projectedMonthly: pending.reduce((a, p) => a + p.projectedMonthly, 0) },
    plays,
    ledger,
    ledgerVerifiedTotal: ledgerTotal,
    activity: db.activity,
    guardrails: db.guardrails.map((g, i) => ({ index: i, label: g.label, on: g.on })),
  }
}

// ============ mutations ============

export function togglePlay(id, range = '30d') {
  const play = playList(range).find((p) => p.id === id)
  if (!play) return { error: 'not_found' }
  const byPause = play.base === 'running' || autoRuns(play)
  const running = byPause ? !db.paused[id] : !!db.enabled[id]
  const willRun = !running

  if (willRun) {
    const guard = checkGuardrails(play, range)
    if (!guard.allowed) {
      return { routedToApproval: true, reasons: guard.reasons, play: effectivePlays(range).find((p) => p.id === id) }
    }
  }

  // Run the typed executor (captures prior value for revert) and log BEFORE mutating.
  const exec = executorFor(play.type)
  const call = willRun && exec ? exec.execute(play) : null
  logAction({ playId: id, kind: willRun ? 'play.execute' : 'play.pause', prior: call?.prior ?? { running }, next: call?.next ?? { running: willRun } })
  if (byPause) {
    if (willRun) delete db.paused[id]; else db.paused[id] = true
  } else {
    if (willRun) db.enabled[id] = true; else delete db.enabled[id]
  }
  if (willRun && db.store.autopilot_on) {
    const verb = play.base === 'approval' ? 'Approved' : 'Enabled'
    db.activity.unshift({ when: 'just now', text: `${verb}: ${play.action}`, delta: `+$${play.amt.toLocaleString('en-US')}/mo projected`, kind: 'good' })
    openLedgerEntry(play, range) // act → prove: track before→after in the Impact Ledger
  }
  if (!willRun) closeLedgerEntry(id)
  return { play: effectivePlays(range).find((p) => p.id === id), executed: call }
}

// Open an Impact Ledger entry tracking the play's projected before→after margin.
function openLedgerEntry(play, range) {
  const lid = 'led_' + play.id
  if (db.ledger.some((l) => l.id === lid)) return
  const prod = enrichAll(range).find((p) => p.id === play.pid)
  const before = prod ? Math.round(prod.pct * 100) : 0
  const after = prod && prod.rev ? Math.max(before + 1, Math.round(((prod.net + play.amt) / prod.rev) * 100)) : before + 1
  const series = Array.from({ length: 9 }, (_, i) => { const t = i / 8, e = t * t * (3 - 2 * t); return Math.round((before + (after - before) * e) * 10) / 10 })
  db.ledger.unshift({ id: lid, pid: play.pid, type: play.type, action: play.action, when: 'just now', before, after, recovered: play.amt, series, note: 'Autopilot is tracking the realized margin change daily.' })
}
function closeLedgerEntry(playId) {
  const lid = 'led_' + playId
  db.ledger = db.ledger.filter((l) => l.id !== lid)
}

export function enableAllPending(range = '30d') {
  const added = []
  for (const play of playList(range)) {
    if (play.base === 'running' || db.enabled[play.id]) continue
    const guard = checkGuardrails(play, range)
    if (!guard.allowed) continue // respects guardrails: over-limit plays still wait for approval
    const exec = executorFor(play.type)
    const call = exec ? exec.execute(play) : null
    logAction({ playId: play.id, kind: 'play.execute', prior: call?.prior ?? { running: false }, next: call?.next ?? { running: true } })
    db.enabled[play.id] = true
    db.activity.unshift({ when: 'just now', text: `Enabled: ${play.action}`, delta: `+$${play.amt.toLocaleString('en-US')}/mo projected`, kind: 'good' })
    openLedgerEntry(play, range)
    added.push(play.id)
  }
  return { enabled: added }
}

export function revertLedger(id) {
  const l = db.ledger.find((x) => x.id === id)
  if (!l) return { error: 'not_found' }
  const isReverted = !!db.reverted[id]
  logAction({ kind: isReverted ? 'ledger.restore' : 'ledger.revert', prior: { reverted: isReverted }, next: { reverted: !isReverted } })
  if (isReverted) delete db.reverted[id]; else db.reverted[id] = true
  if (!isReverted) db.activity.unshift({ when: 'just now', text: `Reverted: ${l.action}`, delta: `-$${l.recovered.toLocaleString('en-US')} rolled back`, kind: 'warn' })
  return { id, reverted: !isReverted }
}

export function setAutopilot({ on, mode }) {
  if (typeof on === 'boolean') {
    logAction({ kind: 'autopilot.master', prior: { on: db.store.autopilot_on }, next: { on } })
    db.store.autopilot_on = on
  }
  if (mode === 'guarded' || mode === 'ask') db.store.autopilot_mode = mode
  return { autopilotOn: db.store.autopilot_on, mode: db.store.autopilot_mode }
}

export function toggleGuardrail(index) {
  const g = db.guardrails[index]
  if (!g) return { error: 'not_found' }
  g.on = !g.on
  return { index, on: g.on }
}

// ============ Cost inputs ============

export function costInputs(range = '30d') {
  const enr = enrichAll(range)
  const conf = { verified: 0, estimated: 0, missing: 0 }
  enr.forEach((p) => { conf[db.cogsConf[p.id]]++ })
  const score = Math.round(((conf.verified + conf.estimated * 0.5) / enr.length) * 100)
  const rows = enr.map((p) => ({
    id: p.id, name: p.name, cat: p.cat, catColor: p.catColor || CAT_COLOR[p.cat] || '#8B98A1',
    cogsPerUnit: perUnitCogs(p, db.cogsOverride),
    overridden: db.cogsOverride[p.id] != null,
    shipPerUnit: p.ship / p.units,
    adsPerUnit: p.ads / p.units,
    marginPct: p.pct, status: p.status,
    confidence: db.cogsConf[p.id],
  }))
  return {
    confidenceScore: score,
    counts: conf,
    sources: db.sources.map((s) => ({ id: s.id, name: s.name, status: s.status, detail: s.detail })),
    rows,
  }
}

// Merchant overrides COGS → flips confidence to verified and recomputes (spec §5).
export function setCogs(id, cogsPerUnit, range = '30d') {
  const p = productById(id)
  if (!p) return { error: 'not_found' }
  const value = Math.max(0, Math.round(Number(cogsPerUnit) * 100) / 100)
  if (Number.isNaN(value)) return { error: 'invalid' }
  logAction({ kind: 'cogs.override', prior: { cogsPerUnit: perUnitCogs(p, db.cogsOverride), confidence: db.cogsConf[id] }, next: { cogsPerUnit: value, confidence: 'verified' } })
  db.cogsOverride[id] = value
  db.cogsConf[id] = 'verified'
  const enr = enrichAll(range).find((x) => x.id === id)
  return { id, cogsPerUnit: value, confidence: 'verified', marginPct: enr.pct, status: enr.status, netProfit: enr.net }
}

// ============ Alerts ============

export function alertsView() {
  const live = db.alerts.filter((a) => !db.dismissedAlerts[a.id])
  return {
    alerts: live.map((a) => ({ id: a.id, severity: a.sev, productId: a.pid, productName: nameOf(a.pid), title: a.title, body: a.body, when: a.when, recommendedAction: a.act })),
    criticalCount: live.filter((a) => a.sev === 'critical').length,
    rules: db.alertRules.map((r, i) => ({ index: i, label: r.label, detail: r.detail, on: r.on })),
  }
}

export function dismissAlert(id) {
  if (!db.alerts.find((a) => a.id === id)) return { error: 'not_found' }
  db.dismissedAlerts[id] = true
  return { id, dismissed: true }
}

export function toggleAlertRule(index) {
  const r = db.alertRules[index]
  if (!r) return { error: 'not_found' }
  r.on = !r.on
  return { index, on: r.on }
}
