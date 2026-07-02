// The single margin compute pipeline. Mirrors BUILD_SPEC.md §2 — keep one source
// of truth so an edited COGS or a changed range cascades everywhere.

export const FACTORS = { '30d': 1, '90d': 2.9, '12mo': 11.6 }
export const RANGE_LABELS = { '30d': 'last 30 days', '90d': 'last 90 days', '12mo': 'last 12 months' }

export function money(n, sym = '$') {
  const s = n < 0 ? '-' : ''
  return s + sym + Math.round(Math.abs(n)).toLocaleString('en-US')
}

export function moneyK(n, sym = '$') {
  const a = Math.abs(n)
  if (a >= 1000) {
    const v = a / 1000
    return (n < 0 ? '-' + sym : sym) + v.toFixed(v >= 100 ? 0 : 1) + 'k'
  }
  return money(n, sym)
}

export function pctTxt(x) {
  const v = x * 100
  return Math.round(v * 10) / 10 + '%'
}

// Per-unit COGS, honoring any merchant override (which flips confidence → verified).
export function perUnitCogs(p, cogsOverride) {
  const o = cogsOverride[p.id]
  if (o != null) return o
  // Real (Shopify) data carries an explicit per-unit cost; seed data derives it from totals.
  if (p.cogsPerUnit != null) return p.cogsPerUnit
  return p.units ? Math.round((p.cogs / p.units) * 100) / 100 : 0
}

// Enrich one product for a given range factor + COGS overrides.
// Returns absolute dollar figures scaled to the window plus derived margin/status.
// Works for both the seed model (window totals) and the Shopify model (per-unit
// cost + 0-sales products).
export function enrich(p, factor, cogsOverride) {
  const m = (k) => (p[k] || 0) * factor
  const ov = cogsOverride[p.id]
  const perUnit = ov != null ? ov : p.cogsPerUnit != null ? p.cogsPerUnit : null
  const cogsBase = perUnit != null ? perUnit * p.units : p.cogs
  const rev = m('rev'), cogs = (cogsBase || 0) * factor, ship = m('ship'), fees = m('fees')
  const ads = m('ads'), disc = m('disc'), ret = m('ret')
  const net = rev - (cogs + ship + fees + ads + disc + ret)
  const pct = rev ? net / rev : 0
  const status = rev === 0 ? 'nosales' : pct < 0 ? 'under' : pct < 0.12 ? 'thin' : 'healthy'
  const leaks = [['Ad spend', ads], ['Shipping', ship], ['Returns', ret], ['Discounts', disc]]
  leaks.sort((a, b) => b[1] - a[1])
  const leakLabel = leaks[0][0], leakShare = rev ? leaks[0][1] / rev : 0
  return { ...p, rev, cogs, ship, fees, ads, disc, ret, net, pct, status, leakLabel, leakShare, units: Math.round(p.units * factor) }
}

// Generic contribution-waterfall geometry. Returns absolutely-positioned step
// styles (revenue bar → cost steps → net bar) plus the zero baseline style.
export function waterfall(rev, costs) {
  const PAD = 22, H = 200
  const total = costs.reduce((a, c) => a + c.value, 0)
  const net = rev - total
  const maxNeg = Math.max(0, -net)
  const span = rev + maxNeg
  const scale = H / span
  const zeroY = PAD + rev * scale
  const steps = []
  const amt = (top, color) => ({ position: 'absolute', left: 0, right: 0, textAlign: 'center', top: top - 16 + 'px', fontFamily: "'JetBrains Mono',monospace", fontSize: '10.5px', fontWeight: 700, color })
  const xl = { position: 'absolute', left: 0, right: 0, textAlign: 'center', top: PAD + H + 12 + 'px', fontSize: '10px', fontWeight: 600, color: '#9AA7AE', letterSpacing: '.01em' }

  steps.push({
    label: 'Revenue', amtText: moneyK(rev),
    style: { position: 'absolute', left: '16%', right: '16%', top: PAD + 'px', height: rev * scale + 'px', background: '#16242E', borderRadius: '4px 4px 0 0' },
    amtStyle: amt(PAD, '#16242E'), xStyle: xl,
  })

  let run = rev
  costs.forEach((c) => {
    const h = c.value * scale
    const top = zeroY - run * scale
    run -= c.value
    steps.push({
      label: c.label, amtText: '−' + moneyK(c.value),
      style: { position: 'absolute', left: '19%', right: '19%', top: top + 'px', height: Math.max(h, 1.5) + 'px', background: c.leak ? '#D6453F' : '#B9C4CA', borderRadius: '2px' },
      amtStyle: amt(top, c.leak ? '#C13A34' : '#8B98A1'), xStyle: xl,
    })
  })

  let nStyle, nTop
  if (net >= 0) {
    nTop = zeroY - net * scale
    nStyle = { position: 'absolute', left: '16%', right: '16%', top: nTop + 'px', height: net * scale + 'px', background: 'linear-gradient(180deg,#16A86E,#0E8F5E)', borderRadius: '4px 4px 0 0' }
  } else {
    nTop = zeroY
    nStyle = { position: 'absolute', left: '16%', right: '16%', top: zeroY + 'px', height: -net * scale + 'px', background: 'linear-gradient(180deg,#E15A54,#BE342E)', borderRadius: '0 0 4px 4px' }
  }
  steps.push({ label: 'Net', amtText: moneyK(net), style: nStyle, amtStyle: amt(nTop, net >= 0 ? '#0E8F5E' : '#C13A34'), xStyle: xl })

  const zeroStyle = { position: 'absolute', left: '4%', right: '4%', top: zeroY + 'px', height: '1px', background: 'rgba(22,36,46,.16)', zIndex: 1 }
  return { steps, zeroStyle }
}
