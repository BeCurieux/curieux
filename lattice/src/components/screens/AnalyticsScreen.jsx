import { T, cardHeading } from '../../lib/styles.js'
import { ScreenHeader, KpiRow } from '../Bits.jsx'

export default function AnalyticsScreen({ v }) {
  return (
    <div className="lt-screen">
      <ScreenHeader
        title="Analytics"
        subtitle="Last 30 days · bundles vs. single-item orders"
        right={<span style={{ fontSize: 12.5, fontWeight: 600, color: T.muted, background: '#fff', border: `1px solid ${T.border}`, padding: '9px 14px', borderRadius: 9 }}>Jun 1 – Jun 30</span>}
      />

      <KpiRow items={v.analyticsKpis} />

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* chart */}
        <div style={{ flex: 1.5, minWidth: 0, background: T.raised, border: `1px solid ${T.border}`, borderRadius: 16, padding: '20px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <span style={cardHeading}>Bundle revenue by week</span>
            <div style={{ display: 'flex', gap: 14, fontSize: 11.5 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: T.muted2 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: T.accent }} />One-time</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: T.muted2 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: T.green }} />Subscription</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 26, height: 200, padding: '0 6px' }}>
            {v.revenueByWeek.map((w) => (
              <div key={w.week} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 46, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: 170 }}>
                  <div style={{ height: v.mounted ? w.oneTime : 0, background: T.accent, borderRadius: '7px 7px 0 0', transition: 'height .7s cubic-bezier(.22,1,.36,1)' }} />
                  <div style={{ height: v.mounted ? w.subscription : 0, background: T.green, borderRadius: '0 0 7px 7px', transition: 'height .7s cubic-bezier(.22,1,.36,1)' }} />
                </div>
                <span style={{ fontSize: 11, color: T.faint, fontWeight: 600 }}>{w.week}</span>
              </div>
            ))}
          </div>
        </div>

        {/* top bundles */}
        <div style={{ flex: 1, minWidth: 0, background: T.raised, border: `1px solid ${T.border}`, borderRadius: 16, padding: '18px 20px' }}>
          <div style={{ ...cardHeading, marginBottom: 16 }}>Top bundles</div>
          {v.topBundles.map((b, i) => (
            <div key={b.rank} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: i === 0 ? '0 0 13px' : '13px 0', borderBottom: i < v.topBundles.length - 1 ? `1px solid ${T.divider}` : 'none' }}>
              <span style={{ fontFamily: T.display, fontWeight: 700, fontSize: 15, color: b.rank === 1 ? T.accent : '#b8a48c', width: 18 }}>{b.rank}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: T.ink }}>{b.name}</div>
                <div style={{ fontSize: 11, color: T.muted2, marginTop: 2 }}>{b.attach}</div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{b.revenue}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
