import { useEffect, useRef, useState } from 'react'
import {
  BASE, CAT_COLOR, RECS_MAP, PLAYS, LEDGER, BASE_ACTIVITY, GUARDRAILS,
  SOURCES, COGS_CONF, ALERT_FEED, ALERT_RULES, TYPE_COLOR, SEED_ROAS, ORDERS_SEED,
} from '../lib/data.js'
import {
  FACTORS, RANGE_LABELS, money as _money, moneyK as _moneyK, pctTxt, perUnitCogs, enrich, waterfall,
} from '../lib/compute.js'
import { SHOPIFY_PRODUCTS, SHOPIFY_STORE, SHOPIFY_SOURCES, SHOPIFY_ORDERS } from '../lib/shopifyData.js'
import { generatePlays } from '../lib/plays.js'
import { segR, segV, segD, navItem, navRail, switchTrack, switchKnob, darkBtn, greyBtn, heldBtn, stepBtn } from '../lib/styles.js'

const PAGE_TITLES = {
  overview: ['Overview', 'Your store at a glance — margins, leaks, and what Autopilot is doing.'],
  margins: ['Margin Waterline', 'True contribution margin after ads, shipping, fees, discounts & returns.'],
  products: ['Products', 'Every product with its true margin, ROAS, and cost confidence.'],
  orders: ['Orders', 'Recent orders flowing into your margin calculations.'],
  costs: ['Cost inputs', 'The numbers behind every margin. Keep them accurate and Autopilot stays sharp.'],
  alerts: ['Alerts', 'Get told the moment a product slips underwater — before it drains a month of profit.'],
  plans: ['Plans & billing', 'Start free. Pay for automation only when it recovers real margin.'],
}

const nameOf = (id) => BASE.find((b) => b.id === id).name
const catOf = (id) => BASE.find((b) => b.id === id).cat

// Easing ramp of N margin-% points from `before` to `after` for ledger sparklines.
const rampSeries = (before, after, n = 9) =>
  Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1)
    const ease = t * t * (3 - 2 * t) // smoothstep
    return Math.round((before + (after - before) * ease) * 10) / 10
  })

// The whole app state + derived "renderVals" object, returned to the view tree.
export default function useWaterline() {
  const [state, setState] = useState({
    view: 'waterline', range: '30d', sortKey: 'net', sortDir: 1, selectedId: null, mounted: false, banner: true, toast: '',
    apOn: true, apMode: 'guarded', enabled: {}, paused: {}, guardOff: {}, extraActivity: [], extraLedger: [],
    expanded: {}, reverted: {},
    nav: 'margins', cogsOverride: {}, alertRuleOff: {}, dismissedAlerts: {},
    onboarding: false, obStep: 0, obShopify: false, obAds: {}, obCogs: null, billYear: false,
    dataSource: 'seed', // 'seed' (Harbor & Vine sample) | 'shopify' (real Mamacita & Crew)
  })
  const toastT = useRef(null)
  const playsRef = useRef([]) // generated plays, for handlers like enableAll

  useEffect(() => {
    const t = setTimeout(() => setState((s) => ({ ...s, mounted: true })), 70)
    return () => { clearTimeout(t); clearTimeout(toastT.current) }
  }, [])

  const set = (patch) => setState((s) => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) }))

  const factor = FACTORS[state.range]
  const rangeLabel = RANGE_LABELS[state.range]

  // ---- data source (sample seed vs real Shopify snapshot) ----
  const isShop = state.dataSource === 'shopify'
  const PRODUCTS = isShop ? SHOPIFY_PRODUCTS : BASE.map((p) => ({ ...p, roas: SEED_ROAS[p.id] }))
  // ROAS display + threshold color (break-even ≈ 1.8×). null → "—" (no ad data).
  const roasText = (r) => (r == null ? '—' : r.toFixed(1) + '×')
  const roasColor = (r) => (r == null ? '#9AA7AE' : r < 1.8 ? '#C13A34' : r < 2.8 ? '#A8770F' : '#0E8F5E')
  const PLAYS_DS = isShop ? [] : PLAYS
  const LEDGER_DS = isShop ? [] : LEDGER
  const ACTIVITY_DS = isShop ? [] : BASE_ACTIVITY
  const SOURCES_DS = isShop ? SHOPIFY_SOURCES : SOURCES
  const ALERTS_DS = isShop ? [] : ALERT_FEED
  const ORDERS_DS = isShop ? SHOPIFY_ORDERS : ORDERS_SEED
  const COGSCONF_DS = isShop ? Object.fromEntries(PRODUCTS.map((p) => [p.id, 'verified'])) : COGS_CONF
  const store = isShop ? SHOPIFY_STORE : { name: 'Harbor & Vine', shop_domain: 'harborandvine.com' }
  const sym = isShop ? 'A$' : '$'
  const money = (n) => _money(n, sym)
  const moneyK = (n) => _moneyK(n, sym)
  const nameOf = (id) => (PRODUCTS.find((b) => b.id === id) || {}).name
  const catOf = (id) => (PRODUCTS.find((b) => b.id === id) || {}).cat

  // ---- toasts ----
  const fireToastKeep = (msg) => {
    set({ toast: msg })
    clearTimeout(toastT.current)
    toastT.current = setTimeout(() => set({ toast: '' }), 2800)
  }
  const fireToast = (msg) => { set({ selectedId: null }); fireToastKeep(msg) }

  // ---- play state helpers ----
  // In GUARDED mode, within-guardrail plays (base 'suggested') run automatically
  // unless paused; over-guardrail plays (base 'approval') always wait for approval.
  // In ASK mode, every play waits to be enabled. Master switch off → all held.
  const autoRuns = (p) => p.base !== 'running' && p.base !== 'approval' && state.apMode === 'guarded'
  const isRunning = (p) => {
    if (!state.apOn) return false
    if (p.base === 'running' || autoRuns(p)) return !state.paused[p.id]
    return !!state.enabled[p.id]
  }
  const togglePlay = (p) => {
    const willRun = !isRunning(p)
    set((s) => {
      const enabled = { ...s.enabled }, paused = { ...s.paused }
      if (p.base === 'running' || autoRuns(p)) { if (willRun) delete paused[p.id]; else paused[p.id] = true }
      else { if (willRun) enabled[p.id] = true; else delete enabled[p.id] }
      let extra = s.extraActivity
      if (willRun && s.apOn) {
        const verb = p.base === 'approval' ? 'Approved' : 'Enabled'
        extra = [{ when: 'just now', text: verb + ': ' + p.action, delta: '+' + money(p.amt) + '/mo projected', kind: 'good' }, ...s.extraActivity]
      }
      return { enabled, paused, extraActivity: extra }
    })
    if (willRun && state.apOn) fireToastKeep(p.base === 'approval' ? 'Approved — Autopilot is running it.' : 'Play enabled — tracking recovery in the ledger.')
  }
  const enableAll = () => {
    const added = playsRef.current.filter((p) => !isRunning(p))
    set((s) => {
      const enabled = { ...s.enabled }, paused = { ...s.paused }
      added.forEach((p) => { if (autoRuns(p)) delete paused[p.id]; else enabled[p.id] = true })
      const extra = added.map((p) => ({ when: 'just now', text: 'Enabled: ' + p.action, delta: '+' + money(p.amt) + '/mo projected', kind: 'good' }))
      return { enabled, paused, extraActivity: [...extra, ...s.extraActivity] }
    })
    fireToastKeep('All pending plays enabled — Autopilot is on it.')
  }
  const revert = (l) => {
    const isReverted = !!state.reverted[l.id]
    set((s) => {
      const reverted = { ...s.reverted }
      if (isReverted) delete reverted[l.id]; else reverted[l.id] = true
      let extra = s.extraActivity
      if (!isReverted) extra = [{ when: 'just now', text: 'Reverted: ' + l.action, delta: '−' + money(l.recovered) + ' rolled back', kind: 'warn' }, ...s.extraActivity]
      return { reverted, extraActivity: extra }
    })
    fireToastKeep(isReverted ? 'Restored — Autopilot is running this play again.' : 'Reverted to the original setting. Nothing lost.')
  }

  const bumpCogs = (p, d) => set((s) => {
    const cur = s.cogsOverride[p.id] != null ? s.cogsOverride[p.id] : Math.round((p.cogs / p.units) * 100) / 100
    const next = Math.max(0, Math.round((cur + d) * 100) / 100)
    return { cogsOverride: { ...s.cogsOverride, [p.id]: next } }
  })

  // ======== derived values (renderVals) ========
  const mounted = state.mounted
  const enr = PRODUCTS.map((p) => enrich(p, factor, state.cogsOverride))
  // Margin views show only products with sales in the window; Cost inputs shows the full catalog.
  const enrSold = enr.filter((p) => p.units > 0)
  const maxAbsPct = Math.max(...enrSold.map((p) => Math.abs(p.pct)), 0.0001) || 1
  const sum = (k) => enr.reduce((a, p) => a + p[k], 0)
  const totRev = sum('rev'), totNet = sum('net')
  const under = enr.filter((p) => p.status === 'under')
  const hiddenLoss = under.reduce((a, p) => a + -p.net, 0)

  // ---- waterline viz ----
  const PADt = 20, UP = 150, DOWN = 120, WLY = PADt + UP
  const wlProducts = enrSold.map((p, i) => {
    const mag = Math.abs(p.pct) / maxAbsPct
    const pos = p.pct >= 0
    const barH = mounted ? mag * (pos ? UP : DOWN) : 0
    const top = pos ? WLY - barH : WLY
    const col = pos ? 'linear-gradient(180deg,#1BB377,#0E8F5E)' : 'linear-gradient(180deg,#E15A54,#BE342E)'
    const labelTop = pos ? (mounted ? top - 18 : WLY - 18) : (mounted ? top + barH + 4 : WLY + 4)
    return {
      id: p.id, short: p.short, netText: moneyK(p.net), open: () => set({ selectedId: p.id }),
      wlBarStyle: {
        position: 'absolute', left: '24%', right: '24%', top: top + 'px', height: barH + 'px', background: col,
        borderRadius: pos ? '5px 5px 2px 2px' : '2px 2px 5px 5px',
        boxShadow: pos ? '0 4px 12px rgba(14,143,94,.28)' : '0 6px 14px rgba(190,52,46,.32)',
        transition: 'top .8s cubic-bezier(.22,1,.36,1), height .8s cubic-bezier(.22,1,.36,1)',
        transitionDelay: i * 45 + 'ms', zIndex: 3,
      },
      wlLabelStyle: {
        position: 'absolute', left: '-8%', right: '-8%', textAlign: 'center', top: labelTop + 'px',
        fontFamily: "'JetBrains Mono',monospace", fontSize: '11px', fontWeight: 700, color: pos ? '#0E8F5E' : '#C13A34',
        transition: 'top .8s cubic-bezier(.22,1,.36,1)', transitionDelay: i * 45 + 'ms', zIndex: 4, opacity: mounted ? 1 : 0,
      },
      wlNameStyle: {
        position: 'absolute', left: '-8%', right: '-8%', textAlign: 'center', top: WLY + DOWN + 16 + 'px',
        fontSize: '10.5px', fontWeight: 600, color: p.catColor || CAT_COLOR[p.cat] || '#8B98A1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      },
    }
  })

  // ---- triage ----
  const sk = state.sortKey, sd = state.sortDir
  const sorted = [...enrSold].sort((a, b) => {
    if (sk === 'name') return sd * a.name.localeCompare(b.name)
    const av = sk === 'margin' ? a.pct : a[sk]
    const bv = sk === 'margin' ? b.pct : b[sk]
    return sd * (av - bv)
  })
  const pill = (st) => (st === 'under' ? { background: '#FBE8E6', color: '#C13A34' } : st === 'thin' ? { background: '#F6ECD7', color: '#A8770F' } : { background: '#E4F3EB', color: '#0E7A50' })
  const pillTxt = (st) => (st === 'under' ? 'Underwater' : st === 'thin' ? 'Thin' : 'Healthy')
  const triProducts = sorted.map((p) => {
    const pos = p.pct >= 0, w = (Math.abs(p.pct) / maxAbsPct) * 50
    const netColor = p.status === 'under' ? '#C13A34' : p.status === 'thin' ? '#A8770F' : '#0E8F5E'
    return {
      id: p.id, name: p.name, cat: p.cat, open: () => set({ selectedId: p.id }),
      unitsText: p.units.toLocaleString('en-US'), revText: moneyK(p.rev), netText: money(p.net), netColor,
      pctText: (pos ? '' : '−') + pctTxt(Math.abs(p.pct)),
      leakText: p.leakLabel + ' ' + pctTxt(p.leakShare),
      roasText: roasText(p.roas), roasColor: roasColor(p.roas),
      dotStyle: { width: '10px', height: '10px', borderRadius: '3px', background: p.catColor || CAT_COLOR[p.cat] || '#8B98A1', flexShrink: 0 },
      pillStyle: { ...pill(p.status), fontSize: '11px', fontWeight: 700, padding: '4px 11px', borderRadius: '20px', whiteSpace: 'nowrap' },
      pillText: pillTxt(p.status),
      marginBarStyle: pos
        ? { position: 'absolute', top: 0, bottom: 0, left: '50%', width: w + '%', background: '#0E8F5E', borderRadius: '0 5px 5px 0' }
        : { position: 'absolute', top: 0, bottom: 0, right: '50%', width: w + '%', background: '#D6453F', borderRadius: '5px 0 0 5px' },
    }
  })
  const arrow = (k) => (sk === k ? (sd > 0 ? '▲' : '▼') : '')
  const arrows = { name: arrow('name'), units: arrow('units'), rev: arrow('rev'), net: arrow('net'), margin: arrow('margin') }

  // ---- leak map (aggregate) ----
  const aggCosts = [
    { label: 'COGS', value: sum('cogs'), leak: false },
    { label: 'Ad spend', value: sum('ads'), leak: true },
    { label: 'Shipping', value: sum('ship'), leak: false },
    { label: 'Returns', value: sum('ret'), leak: true },
    { label: 'Discounts', value: sum('disc'), leak: false },
    { label: 'Fees', value: sum('fees'), leak: false },
  ]
  const aggWf = waterfall(totRev, aggCosts)

  const buckets = [
    { label: 'Cost of goods', value: sum('cogs'), leak: false },
    { label: 'Ad spend', value: sum('ads'), leak: true },
    { label: 'Shipping', value: sum('ship'), leak: false },
    { label: 'Returns', value: sum('ret'), leak: true },
    { label: 'Discounts', value: sum('disc'), leak: false },
    { label: 'Payment fees', value: sum('fees'), leak: false },
  ].sort((a, b) => b.value - a.value)
  const bMax = buckets[0].value
  const leakBuckets = buckets.map((b) => ({
    label: b.label, amtText: moneyK(b.value), pctText: pctTxt(b.value / totRev), pctColor: b.leak ? '#C13A34' : '#6A7780',
    barStyle: { height: '100%', width: (b.value / bMax) * 100 + '%', borderRadius: '6px', background: b.leak ? 'linear-gradient(90deg,#E15A54,#C13A34)' : '#B9C4CA' },
  }))
  const topLeak = [...buckets].filter((b) => b.leak).sort((a, b) => b.value - a.value)[0]
  const leakHeadline = topLeak.label + ' is ' + pctTxt(topLeak.value / totRev) + ' of revenue — your single largest controllable margin leak. Trimming it 20% adds ' + moneyK(topLeak.value * 0.2) + ' straight to net.'

  // ---- autopilot ----
  const apOn = state.apOn
  // Plays are GENERATED from each product's signals (margin, ROAS, returns,
  // shipping, discounts) — not hardcoded. Same brain for sample and real data.
  const genPlays = generatePlays(enr, { money })
  playsRef.current = genPlays
  const eff = genPlays.map((p) => {
    let status
    if (!apOn) status = 'held'
    else if (p.base === 'running' || autoRuns(p)) status = state.paused[p.id] ? 'paused' : 'running' // guarded: auto-runs unless paused
    else status = state.enabled[p.id] ? 'running' : p.base // ask / over-guardrail: needs enable/approval
    return { ...p, status, running: status === 'running' }
  })
  const monthlyRun = eff.filter((p) => p.running).reduce((a, p) => a + p.amt, 0)
  const runningCount = eff.filter((p) => p.running).length
  const pending = eff.filter((p) => p.status === 'suggested' || p.status === 'approval')
  const pendingSum = pending.reduce((a, p) => a + p.amt, 0)
  const quarterRecovered = (isShop ? 0 : 8200) + monthlyRun
  const playsSummary = eff.length ? `${eff.length} plays · ${new Set(eff.map((p) => p.pid)).size} products` : 'No plays yet'

  const badge = {
    running: { bg: '#E4F3EB', c: '#0E7A50', t: 'Running' }, suggested: { bg: '#EAF1F6', c: '#2E6E8E', t: 'Suggested' },
    approval: { bg: '#F6ECD7', c: '#A8770F', t: 'Needs approval' }, paused: { bg: '#ECEAE3', c: '#8B98A1', t: 'Paused' },
    held: { bg: '#ECEAE3', c: '#8B98A1', t: 'Held' },
  }
  const sigColor = { bad: '#C13A34', good: '#0E8F5E', ref: '#6A7780' }
  const buildSignals = (p) => (p.signals || []).map(([label, value, kind]) => ({
    label, value, valStyle: { fontFamily: "'JetBrains Mono',monospace", fontSize: '12px', fontWeight: 700, color: sigColor[kind] },
    barStyle: { width: '5px', alignSelf: 'stretch', borderRadius: '3px', background: sigColor[kind], opacity: kind === 'ref' ? 0.4 : 0.85, flexShrink: 0 },
  }))
  const apPlays = eff.map((p) => {
    const b = badge[p.status]
    const btnLabel = !apOn ? 'Held' : p.running ? 'Pause' : p.base === 'approval' ? 'Approve' : 'Enable'
    const isOpen = !!state.expanded[p.id]
    // ledger seed: before = product's current margin, after = projected with the play applied
    const prod = enr.find((x) => x.id === p.pid)
    const before = prod ? Math.round(prod.pct * 100) : 0
    const after = prod && prod.rev ? Math.max(before + 1, Math.round(((prod.net + p.amt) / prod.rev) * 100)) : before + 1
    const ledger = { id: 'led_' + p.id, pid: p.pid, type: p.type, action: p.action, when: 'just now', before, after, recovered: p.amt, note: 'Autopilot is tracking the realized margin change daily.', series: rampSeries(before, after) }
    return {
      ...p, productName: nameOf(p.pid), amtText: '+' + money(p.amt) + '/mo', ledger,
      pillStyle: { background: b.bg, color: b.c, fontSize: '10.5px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', whiteSpace: 'nowrap', display: 'inline-block' },
      pillText: b.t,
      typeStyle: { background: (TYPE_COLOR[p.type] || '#888') + '1A', color: TYPE_COLOR[p.type] || '#555', fontSize: '10px', fontWeight: 700, padding: '4px 9px', borderRadius: '6px', whiteSpace: 'nowrap', letterSpacing: '.02em', flexShrink: 0 },
      dotStyle: { width: '7px', height: '7px', borderRadius: '50%', background: CAT_COLOR[catOf(p.pid)] || '#8B98A1', flexShrink: 0 },
      btnLabel, btnStyle: !apOn ? heldBtn : p.running ? greyBtn : darkBtn,
      toggle: !apOn ? () => {} : () => togglePlay({ ...p, ledger }),
      isOpen, expand: () => set((s) => ({ expanded: { ...s.expanded, [p.id]: !s.expanded[p.id] } })),
      whyLabel: isOpen ? 'Hide reasoning' : 'Why this play?',
      chevStyle: { display: 'inline-block', transition: 'transform .2s', transform: isOpen ? 'rotate(180deg)' : 'none' },
      signals: buildSignals(p),
    }
  })
  playsRef.current = apPlays // ledger-bearing plays, for enableAll

  const allAct = [...state.extraActivity, ...ACTIVITY_DS]
  const actColor = { good: '#0E8F5E', info: '#3E7CA6', warn: '#A8770F' }
  const activity = allAct.map((a) => ({
    ...a, deltaColor: actColor[a.kind] || '#6A7780',
    dotStyle: { width: '9px', height: '9px', borderRadius: '50%', background: actColor[a.kind] || '#888', flexShrink: 0, marginTop: '4px', boxShadow: '0 0 0 3px ' + (actColor[a.kind] || '#888') + '22' },
  }))

  const guardrailsV = GUARDRAILS.map((g, i) => {
    const on = state.guardOff[i] ? false : g.on
    return { label: g.label, toggle: () => set((s) => ({ guardOff: { ...s.guardOff, [i]: !s.guardOff[i] } })), trackStyle: switchTrack(on), knobStyle: switchKnob(on) }
  })

  // ---- impact ledger ---- (live entries derived from running plays + curated history)
  const runningLedger = apPlays.filter((p) => p.running && p.ledger).map((p) => p.ledger)
  const allLedger = [...runningLedger, ...LEDGER_DS]
  const ledgerV = allLedger.map((l) => {
    const reverted = !!state.reverted[l.id]
    const beforeTxt = (l.before < 0 ? '−' : '') + Math.abs(l.before) + '%'
    const afterTxt = (l.after < 0 ? '−' : '') + Math.abs(l.after) + '%'
    return {
      id: l.id, productName: nameOf(l.pid), action: l.action, when: l.when, note: l.note, type: l.type,
      typeStyle: { background: (TYPE_COLOR[l.type] || '#888') + '1A', color: TYPE_COLOR[l.type] || '#555', fontSize: '10px', fontWeight: 700, padding: '4px 9px', borderRadius: '6px', whiteSpace: 'nowrap', flexShrink: 0 },
      dotStyle: { width: '7px', height: '7px', borderRadius: '50%', background: CAT_COLOR[catOf(l.pid)] || '#8B98A1', flexShrink: 0 },
      beforeTxt, afterTxt,
      recoveredTxt: (reverted ? '' : '+') + money(l.recovered), reverted,
      chartSeries: reverted ? l.series.map(() => l.before) : l.series,
      chartColor: reverted ? '#9AA7AE' : '#0E8F5E',
      cardStyle: { background: reverted ? '#F4F2EC' : '#fff', border: '1px solid ' + (reverted ? 'rgba(22,36,46,.1)' : 'rgba(14,143,94,.18)'), borderRadius: '14px', padding: '15px 17px', opacity: reverted ? 0.72 : 1, transition: 'all .2s' },
      afterColor: reverted ? '#9AA7AE' : '#0E8F5E',
      recoveredColor: reverted ? '#9AA7AE' : '#0E7A50',
      revertLabel: reverted ? 'Restore' : 'Revert',
      revertStyle: { background: reverted ? '#16242E' : '#F1EFE9', color: reverted ? '#fff' : '#8B6A2E', border: 'none', fontFamily: 'inherit', fontSize: '12px', fontWeight: 700, padding: '7px 13px', borderRadius: '8px', cursor: 'pointer', whiteSpace: 'nowrap' },
      revert: () => revert(l),
    }
  })
  const ledgerTotal = allLedger.reduce((a, l) => a + (state.reverted[l.id] ? 0 : l.recovered), 0)

  const apModeDesc = !apOn
    ? 'Paused — plays are held until you switch Autopilot back on.'
    : state.apMode === 'guarded'
      ? 'Acting automatically within your guardrails. Pause anything, anytime.'
      : 'Drafting every play for your one-tap approval before it acts.'

  // ---- cost inputs screen ----
  const srcStatus = { live: { bg: '#E4F3EB', c: '#0E7A50', t: 'Live' }, partial: { bg: '#F6ECD7', c: '#A8770F', t: 'Partial' }, off: { bg: '#ECEAE3', c: '#8B98A1', t: 'Not connected' } }
  const sourcesV = SOURCES_DS.map((s) => {
    const st = srcStatus[s.status]
    return {
      ...s,
      iconStyle: { width: '34px', height: '34px', borderRadius: '9px', background: s.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '15px', flexShrink: 0 },
      pillStyle: { background: st.bg, color: st.c, fontSize: '11px', fontWeight: 700, padding: '4px 11px', borderRadius: '20px', whiteSpace: 'nowrap' },
      pillText: st.t,
      btnText: s.status === 'off' ? 'Connect' : 'Manage',
      btnStyle: s.status === 'off' ? darkBtn : greyBtn,
    }
  })
  const confMeta = { verified: { bg: '#E4F3EB', c: '#0E7A50', t: 'Verified' }, estimated: { bg: '#EAF1F6', c: '#2E6E8E', t: 'Estimated' }, missing: { bg: '#FBE8E6', c: '#C13A34', t: 'Missing' } }
  const confCount = { verified: 0, estimated: 0, missing: 0 }
  enr.forEach((p) => { confCount[COGSCONF_DS[p.id]]++ })
  const costConfidence = Math.round(((confCount.verified + confCount.estimated * 0.5) / enr.length) * 100)
  const costRows = enr.map((p) => {
    const conf = COGSCONF_DS[p.id], cm = confMeta[conf]
    const overridden = state.cogsOverride[p.id] != null
    return {
      id: p.id, name: p.name, cat: p.cat,
      dotStyle: { width: '9px', height: '9px', borderRadius: '3px', background: p.catColor || CAT_COLOR[p.cat] || '#8B98A1', flexShrink: 0 },
      cogsText: sym + perUnitCogs(p, state.cogsOverride).toFixed(2),
      cogsEditedStyle: { fontFamily: "'JetBrains Mono',monospace", fontSize: '13.5px', fontWeight: 700, color: overridden ? '#0E8F5E' : '#16242E', minWidth: '58px', textAlign: 'center' },
      shipText: p.units ? sym + (p.ship / p.units).toFixed(2) : '—',
      adText: p.units ? sym + (p.ads / p.units).toFixed(2) : '—',
      // no sales in the window → margin is undefined; show "—" rather than a misleading 0%
      marginText: p.units ? (p.pct < 0 ? '−' : '') + pctTxt(Math.abs(p.pct)) : '—',
      marginColor: p.units === 0 ? '#9AA7AE' : p.status === 'under' ? '#C13A34' : p.status === 'thin' ? '#A8770F' : '#0E8F5E',
      confStyle: { background: cm.bg, color: cm.c, fontSize: '10.5px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', whiteSpace: 'nowrap' },
      confText: cm.t,
      dec: () => bumpCogs(p, -0.5), inc: () => bumpCogs(p, 0.5),
    }
  })

  // ---- alerts screen ----
  const sevMeta = { critical: { bg: '#FBE8E6', c: '#C13A34', dot: '#D6453F', t: 'Critical' }, warning: { bg: '#F6ECD7', c: '#A8770F', dot: '#D69A2A', t: 'Warning' }, good: { bg: '#E4F3EB', c: '#0E7A50', dot: '#1BB377', t: 'Resolved' } }
  const alertActLabel = { autopilot: 'Hand to Autopilot', view: 'View product', ledger: 'See impact' }
  const liveAlerts = ALERTS_DS.filter((a) => !state.dismissedAlerts[a.id])
  const alertsV = liveAlerts.map((a) => {
    const sm = sevMeta[a.sev]
    return {
      ...a, productName: nameOf(a.pid),
      railStyle: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: sm.dot, borderRadius: '4px 0 0 4px' },
      sevPillStyle: { background: sm.bg, color: sm.c, fontSize: '10.5px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', whiteSpace: 'nowrap' },
      sevText: sm.t,
      actLabel: alertActLabel[a.act],
      actStyle: a.act === 'autopilot'
        ? { background: '#16242E', color: '#fff', border: 'none', fontFamily: 'inherit', fontSize: '12px', fontWeight: 700, padding: '7px 13px', borderRadius: '8px', cursor: 'pointer', whiteSpace: 'nowrap' }
        : { background: '#F1EFE9', color: '#6A7780', border: 'none', fontFamily: 'inherit', fontSize: '12px', fontWeight: 600, padding: '7px 13px', borderRadius: '8px', cursor: 'pointer', whiteSpace: 'nowrap' },
      act_fn: a.act === 'autopilot' || a.act === 'ledger' ? () => set({ nav: 'margins', view: 'autopilot' }) : () => set({ selectedId: a.pid }),
      dismiss: () => { set((s) => ({ dismissedAlerts: { ...s.dismissedAlerts, [a.id]: true } })); fireToastKeep('Alert dismissed.') },
    }
  })
  const critCount = liveAlerts.filter((a) => a.sev === 'critical').length
  const rulesV = ALERT_RULES.map((r, i) => {
    const on = state.alertRuleOff[i] ? false : r.on
    return { label: r.label, detail: r.detail, toggle: () => set((s) => ({ alertRuleOff: { ...s.alertRuleOff, [i]: !s.alertRuleOff[i] } })), trackStyle: switchTrack(on), knobStyle: switchKnob(on) }
  })

  // ---- onboarding ----
  const obSteps = ['Connect store', 'Connect ad spend', 'Confirm costs', 'Set Autopilot']
  const obStep = state.obStep
  const obProgress = obSteps.map((label, i) => ({
    label, num: i + 1, done: i < obStep, active: i === obStep,
    dotStyle: { width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12.5px', fontWeight: 700, flexShrink: 0, background: i < obStep ? '#0E8F5E' : i === obStep ? '#16242E' : '#E3E0D7', color: i <= obStep ? '#fff' : '#9AA7AE' },
    labelStyle: { fontSize: '12.5px', fontWeight: i === obStep ? 700 : 500, color: i === obStep ? '#16242E' : '#9AA7AE', whiteSpace: 'nowrap' },
  }))
  const adPlatforms = [
    { id: 'meta', name: 'Meta Ads', color: '#0866FF', icon: 'M' },
    { id: 'google', name: 'Google Ads', color: '#EA4335', icon: 'G' },
    { id: 'tiktok', name: 'TikTok Ads', color: '#111', icon: 'T' },
  ].map((a) => {
    const connected = !!state.obAds[a.id]
    return {
      ...a, connected, notConnected: !connected,
      iconStyle: { width: '34px', height: '34px', borderRadius: '9px', background: a.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '15px', flexShrink: 0 },
      connect: () => set((s) => ({ obAds: { ...s.obAds, [a.id]: true } })),
    }
  })
  const cogsOptions = [
    { id: 'shopify', t: 'Import from Shopify', d: 'Use the cost-per-item field on your products. Fastest.' },
    { id: 'csv', t: 'Upload a CSV', d: 'Map your own cost sheet. Best if costs live in a spreadsheet.' },
    { id: 'manual', t: 'Enter manually', d: 'Type costs per product inside Waterline later.' },
  ].map((o) => {
    const selected = state.obCogs === o.id
    return {
      ...o, selected, pick: () => set({ obCogs: o.id }),
      cardStyle: { display: 'flex', alignItems: 'flex-start', gap: '13px', background: '#fff', border: '2px solid ' + (selected ? '#16242E' : 'rgba(22,36,46,.08)'), borderRadius: '13px', padding: '15px 18px', cursor: 'pointer', transition: 'all .15s' },
      radioStyle: { width: '20px', height: '20px', borderRadius: '50%', border: '2px solid ' + (selected ? '#16242E' : '#CFCBC1'), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px', transition: 'all .15s' },
      radioDot: { width: '10px', height: '10px', borderRadius: '50%', background: selected ? '#16242E' : 'transparent' },
    }
  })
  const obNextDisabled = (obStep === 0 && !state.obShopify) || (obStep === 2 && !state.obCogs)
  const obPrimaryStyle = { flex: 1, background: obNextDisabled ? '#C7C3B8' : '#16242E', color: '#fff', border: 'none', fontFamily: 'inherit', fontSize: '14px', fontWeight: 700, padding: '13px', borderRadius: '11px', cursor: obNextDisabled ? 'not-allowed' : 'pointer' }

  // ---- pricing ----
  const billYear = state.billYear
  const vbRate = 0.12
  const vbFeeMonthly = Math.round((quarterRecovered / 3) * vbRate)
  const keep = Math.round(quarterRecovered / 3) - vbFeeMonthly
  const plans = [
    { id: 'lookout', name: 'Lookout', tagline: "Find out what's really profitable.", priceMo: 0, priceYr: 0, highlight: false, current: false, cta: 'Start free', note: 'Free forever', features: ['True margin on every product', 'Underwater & margin-drop alerts', '1 ad platform connected', 'Manual fixes — you act yourself'] },
    { id: 'operator', name: 'Operator', tagline: 'See it all, act with one tap.', priceMo: 149, priceYr: 119, highlight: false, current: true, cta: 'Current plan', note: billYear ? 'billed annually' : 'billed monthly', features: ['Everything in Lookout', 'All ad platforms · unlimited SKUs', 'Ask-first Autopilot (one-tap approve)', 'Impact Ledger & one-tap revert', 'Email + Slack alerts'] },
    { id: 'autopilot', name: 'Autopilot+', tagline: 'It fixes the leaks. You keep the margin.', priceMo: 299, priceYr: 239, highlight: true, current: false, cta: 'Upgrade to Autopilot+', note: '+ 12% of verified recovered margin', features: ['Everything in Operator', 'Guarded autonomous Autopilot', 'You pay only from money it recovers', 'Custom guardrail policies', 'Priority support'] },
  ].map((p) => {
    const price = billYear ? p.priceYr : p.priceMo
    return {
      ...p, priceText: price === 0 ? '$0' : '$' + price, per: price === 0 ? 'forever' : '/mo',
      cardStyle: { position: 'relative', background: p.highlight ? '#16242E' : '#fff', border: '1px solid ' + (p.highlight ? '#16242E' : 'rgba(22,36,46,.1)'), borderRadius: '18px', padding: p.highlight ? '30px 24px 24px' : '24px', boxShadow: p.highlight ? '0 18px 44px rgba(22,36,46,.22)' : '0 1px 2px rgba(22,36,46,.04)', transform: p.highlight ? 'translateY(-6px)' : 'none' },
      nameColor: p.highlight ? '#fff' : '#16242E',
      taglineColor: p.highlight ? '#AEBCC4' : '#6A7780',
      priceColor: p.highlight ? '#fff' : '#16242E',
      perColor: p.highlight ? '#7E8E97' : '#9AA7AE',
      noteColor: p.highlight ? '#1BB377' : '#6A7780',
      divider: p.highlight ? 'rgba(255,255,255,.1)' : 'rgba(22,36,46,.08)',
      featColor: p.highlight ? '#D4DDE1' : '#3C4B48',
      tickColor: p.highlight ? '#1BB377' : '#0E8F5E',
      ctaStyle: p.current
        ? { width: '100%', marginTop: '16px', background: '#EDEBE4', color: '#8B98A1', border: 'none', fontFamily: 'inherit', fontSize: '13.5px', fontWeight: 700, padding: '12px', borderRadius: '11px', cursor: 'default' }
        : p.highlight
          ? { width: '100%', marginTop: '16px', background: '#1BB377', color: '#06231A', border: 'none', fontFamily: 'inherit', fontSize: '13.5px', fontWeight: 700, padding: '12px', borderRadius: '11px', cursor: 'pointer' }
          : { width: '100%', marginTop: '16px', background: '#16242E', color: '#fff', border: 'none', fontFamily: 'inherit', fontSize: '13.5px', fontWeight: 700, padding: '12px', borderRadius: '11px', cursor: 'pointer' },
      pick: () => fireToastKeep(p.name === 'Autopilot+' ? 'Autopilot+ selected — you only pay from recovered margin.' : p.name + ' selected.'),
    }
  })
  const billToggleKnob = { position: 'absolute', top: '3px', left: billYear ? 'calc(50% + 1px)' : '3px', width: 'calc(50% - 4px)', height: 'calc(100% - 6px)', background: '#fff', borderRadius: '8px', transition: 'all .2s', boxShadow: '0 1px 3px rgba(22,36,46,.18)' }
  const billLabelStyle = (on) => ({ position: 'relative', zIndex: 1, padding: '7px 16px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', color: on ? '#16242E' : '#8B98A1', transition: 'color .2s', display: 'flex', alignItems: 'center', gap: '6px' })

  // ---- products screen (full catalog) ----
  const statusPill = (st) => st === 'under' ? { background: '#FBE8E6', color: '#C13A34', t: 'Underwater' }
    : st === 'thin' ? { background: '#F6ECD7', color: '#A8770F', t: 'Thin' }
      : st === 'nosales' ? { background: '#ECEAE3', color: '#8B98A1', t: 'No sales' }
        : { background: '#E4F3EB', color: '#0E7A50', t: 'Healthy' }
  const productRows = enr.map((p) => {
    const sp = statusPill(p.status), cm = confMeta[COGSCONF_DS[p.id]] || confMeta.estimated
    return {
      id: p.id, name: p.name, cat: p.cat, open: () => set({ selectedId: p.id }),
      dotStyle: { width: '10px', height: '10px', borderRadius: '3px', background: p.catColor || CAT_COLOR[p.cat] || '#8B98A1', flexShrink: 0 },
      unitsText: p.units ? p.units.toLocaleString('en-US') : '—',
      revText: p.units ? moneyK(p.rev) : '—',
      netText: p.units ? money(p.net) : '—',
      netColor: p.units === 0 ? '#9AA7AE' : p.status === 'under' ? '#C13A34' : p.status === 'thin' ? '#A8770F' : '#0E8F5E',
      marginText: p.units ? (p.pct < 0 ? '−' : '') + pctTxt(Math.abs(p.pct)) : '—',
      roasText: roasText(p.roas), roasColor: roasColor(p.roas),
      pillStyle: { background: sp.background, color: sp.color, fontSize: '11px', fontWeight: 700, padding: '4px 11px', borderRadius: '20px', whiteSpace: 'nowrap' }, pillText: sp.t,
      confStyle: { background: cm.bg, color: cm.c, fontSize: '10.5px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', whiteSpace: 'nowrap' }, confText: cm.t,
    }
  })

  // ---- orders screen ----
  const orderStatus = { fulfilled: { bg: '#E4F3EB', c: '#0E7A50', t: 'Fulfilled' }, paid: { bg: '#EAF1F6', c: '#2E6E8E', t: 'Paid' }, refunded: { bg: '#FBE8E6', c: '#C13A34', t: 'Refunded' }, pending: { bg: '#F6ECD7', c: '#A8770F', t: 'Pending' } }
  const ordersV = ORDERS_DS.map((o) => {
    const s = orderStatus[o.status] || orderStatus.paid
    return { ...o, totalText: money(o.total), itemsText: o.items + (o.items === 1 ? ' item' : ' items'), pillStyle: { background: s.bg, color: s.c, fontSize: '11px', fontWeight: 700, padding: '3px 11px', borderRadius: '20px', whiteSpace: 'nowrap' }, pillText: s.t }
  })
  const ordersCount = ordersV.length

  // ---- overview highlights ----
  const topProducts = [...enrSold].sort((a, b) => b.net - a.net).slice(0, 5).map((p) => ({
    id: p.id, name: p.name, cat: p.cat, catColor: p.catColor || CAT_COLOR[p.cat] || '#8B98A1',
    netText: money(p.net), netColor: p.net < 0 ? '#C13A34' : '#0E8F5E', marginText: (p.pct < 0 ? '−' : '') + pctTxt(Math.abs(p.pct)),
    open: () => set({ selectedId: p.id }),
  }))

  // ---- nav + chrome ----
  const nav = state.nav
  const [pageTitle, pageSubtitle] = PAGE_TITLES[nav]

  // ---- selected drawer ----
  const selRaw = enr.find((p) => p.id === state.selectedId)
  let sel = null, selWf = { steps: [], zeroStyle: {} }
  if (selRaw) {
    const selCosts = [
      { label: 'COGS', value: selRaw.cogs, leak: false },
      { label: 'Ad spend', value: selRaw.ads, leak: selRaw.leakLabel === 'Ad spend' },
      { label: 'Shipping', value: selRaw.ship, leak: selRaw.leakLabel === 'Shipping' },
      { label: 'Returns', value: selRaw.ret, leak: selRaw.leakLabel === 'Returns' },
      { label: 'Discounts', value: selRaw.disc, leak: selRaw.leakLabel === 'Discounts' },
      { label: 'Fees', value: selRaw.fees, leak: false },
    ]
    selWf = waterfall(selRaw.rev, selCosts)
    const pos = selRaw.pct >= 0
    const selPlays = apPlays.filter((p) => p.pid === selRaw.id)
    sel = {
      ...selRaw,
      unitsText: selRaw.units.toLocaleString('en-US'),
      netText: money(selRaw.net),
      netColor: selRaw.status === 'under' ? '#C13A34' : selRaw.status === 'thin' ? '#A8770F' : '#0E8F5E',
      pctText: (pos ? '' : '−') + pctTxt(Math.abs(selRaw.pct)),
      roasText: roasText(selRaw.roas), roasColor: roasColor(selRaw.roas),
      perUnitText: money(selRaw.units ? selRaw.net / selRaw.units : 0),
      recs: RECS_MAP[selRaw.id] || [],
      plays: selPlays,
      hasPlays: selPlays.length > 0,
      noPlays: selPlays.length === 0,
      fixHeader: selPlays.length > 0 ? 'Autopilot plays' : 'Opportunities',
      dotStyleLg: { width: '40px', height: '40px', borderRadius: '11px', background: selRaw.catColor || CAT_COLOR[selRaw.cat] || '#8B98A1', flexShrink: 0 },
    }
  }

  return {
    // range
    range: state.range, rangeLabel,
    setRange30: () => set({ range: '30d' }), setRange90: () => set({ range: '90d' }), setRange12: () => set({ range: '12mo' }),
    range30Style: segR(state.range === '30d'), range90Style: segR(state.range === '90d'), range12Style: segR(state.range === '12mo'),
    // data source
    dataSource: state.dataSource, isShop,
    showDeltas: !isShop, // sample has illustrative vs-prior deltas; the real store has no prior period yet
    storeName: store.name, storeDomain: store.shop_domain, storeInitial: (store.name || '?')[0],
    setSeed: () => set({ dataSource: 'seed', selectedId: null, view: 'waterline', nav: 'margins' }),
    setShopify: () => set({ dataSource: 'shopify', selectedId: null, view: 'waterline', nav: 'margins' }),
    // banner
    showBanner: state.banner && under.length > 0, dismissBanner: () => set({ banner: false }),
    bannerCount: under.length, bannerLoss: money(hiddenLoss) + '/mo',
    // kpis
    kpiRevenue: money(totRev), kpiNet: money(totNet), kpiMargin: pctTxt(totNet / totRev),
    kpiUnderCount: String(under.length), kpiHiddenLoss: money(hiddenLoss) + '/mo',
    // view switch
    isWaterline: state.view === 'waterline', isTriage: state.view === 'triage', isLeak: state.view === 'leak', isAutopilot: state.view === 'autopilot',
    setWaterline: () => set({ view: 'waterline' }), setTriage: () => set({ view: 'triage' }), setLeak: () => set({ view: 'leak' }), setAutopilot: () => set({ view: 'autopilot' }),
    wlBtnStyle: segV(state.view === 'waterline'), triBtnStyle: segV(state.view === 'triage'), leakBtnStyle: segV(state.view === 'leak'), apBtnStyle: segV(state.view === 'autopilot'),
    // autopilot
    apOn, apOnText: apOn ? 'ON' : 'OFF', toggleAp: () => set((s) => ({ apOn: !s.apOn })), apModeDesc,
    apSwitchTrack: { width: '52px', height: '30px', borderRadius: '30px', background: apOn ? '#1BB377' : 'rgba(255,255,255,.22)', position: 'relative', cursor: 'pointer', transition: 'all .2s', flexShrink: 0 },
    apSwitchKnob: { position: 'absolute', top: '3px', left: apOn ? '25px' : '3px', width: '24px', height: '24px', borderRadius: '50%', background: '#fff', transition: 'all .2s', boxShadow: '0 2px 5px rgba(0,0,0,.28)' },
    modeGuardStyle: segD(state.apMode === 'guarded'), modeAskStyle: segD(state.apMode === 'ask'),
    setModeGuarded: () => set({ apMode: 'guarded' }), setModeAsk: () => set({ apMode: 'ask' }),
    recoveredText: money(quarterRecovered), runningCount: String(runningCount),
    hasPending: apOn && pending.length > 0, pendingCount: String(pending.length), pendingSumText: money(pendingSum),
    enableAll,
    apPlays, activity, guardrails: guardrailsV,
    ledger: ledgerV, ledgerTotalText: money(ledgerTotal), ledgerCount: String(allLedger.length), playsSummary,
    // top-level nav
    nav, isNavMargins: nav === 'margins', isNavCosts: nav === 'costs', isNavAlerts: nav === 'alerts', isNavPlans: nav === 'plans',
    isNavOverview: nav === 'overview', isNavProducts: nav === 'products', isNavOrders: nav === 'orders',
    goMargins: () => set({ nav: 'margins', selectedId: null }), goCosts: () => set({ nav: 'costs', selectedId: null }), goAlerts: () => set({ nav: 'alerts', selectedId: null }), goPlans: () => set({ nav: 'plans', selectedId: null }),
    goOverview: () => set({ nav: 'overview', selectedId: null }), goProducts: () => set({ nav: 'products', selectedId: null }), goOrders: () => set({ nav: 'orders', selectedId: null }),
    goAutopilot: () => set({ nav: 'margins', view: 'autopilot' }),
    navMargins: navItem(nav === 'margins'), navCosts: navItem(nav === 'costs'), navAlerts: navItem(nav === 'alerts'), navPlans: navItem(nav === 'plans'),
    navMarginsRail: navRail(nav === 'margins'), navCostsRail: navRail(nav === 'costs'), navAlertsRail: navRail(nav === 'alerts'), navPlansRail: navRail(nav === 'plans'),
    navOverview: navItem(nav === 'overview'), navProducts: navItem(nav === 'products'), navOrders: navItem(nav === 'orders'),
    navOverviewRail: navRail(nav === 'overview'), navProductsRail: navRail(nav === 'products'), navOrdersRail: navRail(nav === 'orders'),
    // overview / products / orders
    topProducts, productRows, productCount: String(enr.length), orders: ordersV, ordersCount: String(ordersCount),
    // pricing
    plans, billYear, toggleBill: () => set((s) => ({ billYear: !s.billYear })),
    billMoStyle: billLabelStyle(!billYear), billYrStyle: billLabelStyle(billYear), billToggleKnob,
    roiRecoveredText: money(Math.round(quarterRecovered / 3)), roiFeeText: money(vbFeeMonthly), roiKeepText: money(keep),
    pageTitle, pageSubtitle,
    // cost inputs
    sources: sourcesV, costRows, costConfidence: costConfidence + '%', missingCount: String(confCount.missing), hasMissingCosts: confCount.missing > 0,
    verifiedCount: String(confCount.verified), estimatedCount: String(confCount.estimated), stepBtn,
    // alerts
    alerts: alertsV, alertRules: rulesV, critCount: String(critCount), liveAlertCount: String(liveAlerts.length),
    hasAlerts: liveAlerts.length > 0, noAlerts: liveAlerts.length === 0,
    // onboarding
    onboarding: state.onboarding, openOnboarding: () => set({ onboarding: true, obStep: 0 }), closeOnboarding: () => set({ onboarding: false }),
    obStep, obProgress, obStepIs0: obStep === 0, obStepIs1: obStep === 1, obStepIs2: obStep === 2, obStepIs3: obStep === 3, obNotStep3: obStep !== 3,
    obShopify: state.obShopify, obConnectShopify: () => set({ obShopify: true }),
    obShopifyBtnText: state.obShopify ? 'Connected ✓' : 'Connect Shopify',
    obShopifyBtnStyle: { background: state.obShopify ? '#E4F3EB' : '#95BF47', color: state.obShopify ? '#0E7A50' : '#16242E', border: 'none', fontFamily: 'inherit', fontSize: '14px', fontWeight: 700, padding: '12px 20px', borderRadius: '11px', cursor: 'pointer', width: '100%' },
    adPlatforms, cogsOptions,
    obNext: () => set((s) => ({ obStep: Math.min(s.obStep + 1, 3) })), obBack: () => set((s) => ({ obStep: Math.max(s.obStep - 1, 0) })),
    obFinish: () => { set({ onboarding: false }); fireToastKeep('Setup complete — Waterline is watching your margins.') },
    obNextDisabled, obPrimaryStyle, obShowBack: obStep > 0,
    // waterline
    wlProducts,
    // triage
    triProducts, arrows,
    sortName: () => set((s) => ({ sortKey: 'name', sortDir: s.sortKey === 'name' ? -s.sortDir : 1 })),
    sortUnits: () => set((s) => ({ sortKey: 'units', sortDir: s.sortKey === 'units' ? -s.sortDir : 1 })),
    sortRev: () => set((s) => ({ sortKey: 'rev', sortDir: s.sortKey === 'rev' ? -s.sortDir : 1 })),
    sortNet: () => set((s) => ({ sortKey: 'net', sortDir: s.sortKey === 'net' ? -s.sortDir : 1 })),
    sortMargin: () => set((s) => ({ sortKey: 'margin', sortDir: s.sortKey === 'margin' ? -s.sortDir : 1 })),
    // leak map
    aggSteps: aggWf.steps, aggZeroStyle: aggWf.zeroStyle, leakBuckets, leakHeadline,
    // drawer
    showDrawer: !!sel, sel, selSteps: selWf.steps, selZeroStyle: selWf.zeroStyle,
    closeDrawer: () => set({ selectedId: null }),
    applyFix: () => fireToast('Fixes queued — Waterline will track the margin change daily.'),
    snoozeFix: () => fireToast('Snoozed for 14 days. We\'ll re-check this product then.'),
    // toast
    showToast: !!state.toast, toast: state.toast,
  }
}
