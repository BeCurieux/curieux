import { T, card, screenTitle, screenSub, cardHeading, mono as monoStyle } from '../lib/styles.js'

// Screen header: Bricolage title + muted subtitle, optional right-side actions.
export function ScreenHeader({ title, subtitle, right, align = 'flex-start' }) {
  return (
    <div style={{ display: 'flex', alignItems: align, justifyContent: 'space-between', marginBottom: 22, gap: 16 }}>
      <div>
        <h1 style={screenTitle}>{title}</h1>
        {subtitle && <div style={screenSub}>{subtitle}</div>}
      </div>
      {right}
    </div>
  )
}

const deltaColor = { good: T.green, muted: T.muted2 }

// KPI card used on Home, Subscriptions, Analytics.
export function Kpi({ label, value, delta, deltaKind = 'muted', valueColor }) {
  return (
    <div className="lt-card" style={{ ...card }}>
      <div style={{ fontSize: 12, color: T.muted2, fontWeight: 600, marginBottom: 11 }}>{label}</div>
      <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: 25, color: valueColor || T.ink }}>{value}</div>
      {delta && (
        <div style={{ fontSize: 12, fontWeight: deltaKind === 'good' ? 700 : 600, color: deltaColor[deltaKind] || T.muted2, marginTop: 7 }}>
          {delta}
        </div>
      )}
    </div>
  )
}

export function KpiRow({ items }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 22 }}>
      {items.map((k) => <Kpi key={k.label} {...k} />)}
    </div>
  )
}

// Monogram tile (initials on a tinted background).
export function Mono({ name, code, size = 42, radius = 10, fontSize = 12 }) {
  return <div style={monoStyle(name, size, radius, fontSize)}>{code}</div>
}

export function CardHeader({ title, right, sub }) {
  return (
    <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.divider}`, display: 'flex', alignItems: sub ? 'flex-start' : 'center', justifyContent: 'space-between' }}>
      <div>
        <span style={cardHeading}>{title}</span>
        {sub && <div style={{ fontSize: 12, color: T.muted2, marginTop: 3 }}>{sub}</div>}
      </div>
      {right}
    </div>
  )
}
