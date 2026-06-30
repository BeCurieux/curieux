import { T, cardHeading } from '../../lib/styles.js'
import { ScreenHeader } from '../Bits.jsx'

export default function PerformanceScreen({ v }) {
  return (
    <div className="lt-screen">
      <ScreenHeader
        title="Performance"
        subtitle="An 11 kb vanilla-JS widget, loaded async. No framework, no jQuery, no render-blocking — your theme stays fast."
      />

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', marginBottom: 20 }}>
        {/* big score */}
        <div style={{ flex: 1, background: T.dark, borderRadius: 18, padding: 26, color: T.appBg, display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ width: 104, height: 104, borderRadius: '50%', background: `conic-gradient(${T.greenOnDark} 356deg,rgba(255,255,255,.12) 0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
            <div style={{ width: 82, height: 82, borderRadius: '50%', background: T.dark, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: T.display, fontWeight: 700, fontSize: 34, color: T.greenOnDark, lineHeight: 1 }}>{v.perfScore}</span>
              <span style={{ fontSize: 9.5, color: T.darkBody, letterSpacing: '.05em' }}>LIGHTHOUSE</span>
            </div>
          </div>
          <div>
            <div style={{ fontFamily: T.display, fontWeight: 600, fontSize: 17, color: '#fff', marginBottom: 8 }}>Mobile performance is green</div>
            <div style={{ fontSize: 12.5, color: T.darkBody, lineHeight: 1.5, maxWidth: 280 }}>Measured on the live product page with the bundle widget mounted. Legacy bundle apps drag this score to the low 60s.</div>
          </div>
        </div>

        {/* metric grid */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {v.perfMetrics.map((m) => (
            <div key={m.label} className="lt-card" style={{ background: T.raised, border: `1px solid ${T.border}`, borderRadius: 15, padding: 18 }}>
              <div style={{ fontSize: 11.5, color: T.muted2, fontWeight: 700, marginBottom: 9 }}>{m.label}</div>
              <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: 24, color: m.valueColor || T.ink }}>
                {m.value}{m.unit && <span style={{ fontSize: 14, color: T.muted2 }}>{m.unit}</span>}
              </div>
              <div style={{ fontSize: 11, color: T.muted2, marginTop: 5 }}>{m.note}</div>
            </div>
          ))}
        </div>
      </div>

      {/* comparison */}
      <div style={{ background: T.raised, border: `1px solid ${T.border}`, borderRadius: 16, padding: '20px 22px' }}>
        <div style={{ ...cardHeading, marginBottom: 18 }}>How Lattice loads vs. legacy bundle apps</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {v.perfComparison.map((bar) => (
            <div key={bar.label} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ width: 140, fontSize: 13, color: bar.strong ? T.ink : T.muted2, fontWeight: bar.strong ? 700 : 600 }}>{bar.label}</span>
              <div style={{ flex: 1, height: 18, background: T.appBg, borderRadius: 9, overflow: 'hidden' }}>
                <div style={{ width: `${v.mounted ? bar.width : 0}%`, height: '100%', background: bar.color, borderRadius: 9, transition: 'width .8s cubic-bezier(.22,1,.36,1)' }} />
              </div>
              <span style={{ width: 64, textAlign: 'right', fontSize: 12.5, color: bar.sizeColor, fontWeight: bar.strong ? 700 : 600 }}>{bar.size}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
