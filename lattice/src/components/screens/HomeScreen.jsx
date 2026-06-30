import { T, primaryBtn, panel, cardHeading } from '../../lib/styles.js'
import { ScreenHeader, KpiRow, Mono } from '../Bits.jsx'
import { IconWarning } from '../Icons.jsx'

const dotColor = { warn: T.warn, amber: T.amber, good: T.green }

export default function HomeScreen({ v }) {
  return (
    <div className="lt-screen">
      <ScreenHeader
        align="flex-end"
        title="Good morning, Northbound"
        subtitle="Monday, June 30 · 4 live bundles · everything synced"
        right={<button className="lt-btn" style={primaryBtn} onClick={v.nav.bundles.go}>+ New bundle</button>}
      />

      {/* alert banner */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 13, background: T.warnTint, border: `1px solid ${T.warnBorder}`, borderRadius: 13, padding: '14px 18px', marginBottom: 20 }}>
        <IconWarning />
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 13.5, color: T.warnText, fontWeight: 600 }}>Canvas Field Tote is out of stock in New York.</span>
          <span style={{ fontSize: 13, color: T.warnText2 }}> "Summer Essentials 3-Pack" is auto-hidden for East-Coast buyers to prevent split shipments.</span>
        </div>
        <button className="lt-btn" style={{ fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, color: T.warn, background: '#fff', border: `1px solid ${T.accentBorder}`, padding: '8px 14px', borderRadius: 9, cursor: 'pointer' }} onClick={v.nav.inventory.go}>View inventory</button>
      </div>

      <KpiRow items={v.homeKpis} />

      {/* two-column body */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* your bundles */}
        <div style={{ flex: 1.7, minWidth: 0, ...panel }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.divider}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={cardHeading}>Your bundles</span>
            <span style={{ fontSize: 12.5, color: T.accent, fontWeight: 700, cursor: 'pointer' }} onClick={v.nav.bundles.go}>Manage all →</span>
          </div>
          <div style={{ padding: '6px 10px' }}>
            {v.bundles.map((b) => (
              <div key={b.id} className="lt-nav" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 12px', borderRadius: 11, cursor: 'pointer' }} onClick={v.nav.bundles.go}>
                <Mono name={b.tile} code={b.code} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5, color: T.ink }}>{b.name}</div>
                  <div style={{ fontSize: 11.5, color: T.muted2, marginTop: 2 }}>{b.itemCount} items · {b.type} · ${b.price}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: T.ink }}>{b.attach}% attach</div>
                  <div style={{ fontSize: 11, fontWeight: 600, marginTop: 2, color: b.statusKind === 'warn' ? T.warn : T.green }}>{b.status}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* right column */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: T.raised, border: `1px solid ${T.border}`, borderRadius: 16, padding: '18px 20px' }}>
            <div style={{ ...cardHeading, marginBottom: 14 }}>Needs attention</div>
            {v.homeAttention.map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: 11, alignItems: 'flex-start', padding: i === 0 ? '0 0 13px' : '13px 0', borderBottom: i < v.homeAttention.length - 1 ? `1px solid ${T.divider}` : 'none' }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: dotColor[a.dot], marginTop: 4, flex: 'none' }} />
                <div style={{ fontSize: 12.5, color: T.body, lineHeight: 1.4 }}>
                  <b style={{ color: T.ink }}>{a.strong}</b>{a.rest}
                </div>
              </div>
            ))}
          </div>

          {/* dark revenue card */}
          <div style={{ background: T.dark, borderRadius: 16, padding: '18px 20px', color: T.appBg }}>
            <div style={{ fontFamily: T.display, fontWeight: 600, fontSize: 14, color: '#fff', marginBottom: 5 }}>This month, bundles drove</div>
            <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: 30, color: '#fff', lineHeight: 1.1 }}>
              $48.2k <span style={{ fontSize: 14, color: T.greenOnDark, fontWeight: 600 }}>· 27% of revenue</span>
            </div>
            <div style={{ fontSize: 12, color: T.darkBody, marginTop: 10, lineHeight: 1.45 }}>
              Bundled orders have a <b style={{ color: '#fff' }}>19% higher AOV</b> and a <b style={{ color: '#fff' }}>2.4× repeat rate</b> when subscribed.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
