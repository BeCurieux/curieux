import { T, primaryBtn, panel, cardHeading } from '../../lib/styles.js'
import { ScreenHeader, KpiRow, Mono } from '../Bits.jsx'

export default function SubsScreen({ v }) {
  return (
    <div className="lt-screen">
      <ScreenHeader
        title="Subscriptions"
        subtitle="Bundles renew natively through Shopify Selling Plans — no second checkout, no app collision."
        right={<button className="lt-btn" style={primaryBtn} onClick={v.newSellingPlan}>+ New selling plan</button>}
      />

      <KpiRow items={v.subsKpis} />

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* upcoming renewals */}
        <div style={{ flex: 1.5, minWidth: 0, ...panel }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.divider}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={cardHeading}>Upcoming renewals</span>
            <span style={{ fontSize: 12, color: T.muted2 }}>Next 7 days · 86 boxes</span>
          </div>
          <div style={{ padding: '6px 8px' }}>
            {v.renewals.map((r, i) => (
              <div key={r.code} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '12px', borderRadius: 10, borderTop: i === 0 ? 'none' : `1px solid ${T.divider2}` }}>
                <Mono name={r.tile} code={r.code} size={38} radius={9} fontSize={11} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: T.ink }}>{r.name}</div>
                  <div style={{ fontSize: 11.5, color: T.muted2, marginTop: 2 }}>{r.cadence} · {r.subs} subscribers</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: T.ink }}>{r.date}</div>
                  <div style={{ fontSize: 11, color: T.green, fontWeight: 600, marginTop: 2 }}>{r.amount}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* selling plans */}
        <div style={{ flex: 1, minWidth: 0, background: T.raised, border: `1px solid ${T.border}`, borderRadius: 16, padding: '18px 20px' }}>
          <div style={{ ...cardHeading, marginBottom: 14 }}>Selling plans</div>
          {v.sellingPlans.map((p) => (
            <div key={p.id} style={{ border: `${p.primary ? 1.5 : 1}px solid ${p.primary ? T.accentBorder : T.border}`, background: p.primary ? T.accentTint2 : 'transparent', borderRadius: 12, padding: 14, marginBottom: 11 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: T.ink }}>{p.name}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: T.green }}>Active</span>
              </div>
              <div style={{ fontSize: 11.5, color: T.muted2, marginTop: 5 }}>{p.cadence} · applies to {p.bundles} {p.bundles === 1 ? 'bundle' : 'bundles'} · {p.subs} subs</div>
            </div>
          ))}
          <div onClick={v.addPlan} style={{ border: `1px dashed ${T.dash}`, borderRadius: 12, padding: 13, textAlign: 'center', color: T.accent, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>+ Add a plan</div>
        </div>
      </div>
    </div>
  )
}
