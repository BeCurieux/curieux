import { T, ghostBtn, panel, cardHeading, pill } from '../../lib/styles.js'
import { ScreenHeader } from '../Bits.jsx'

const dotColor = { good: T.green, amber: T.amber, warn: T.warn }
const sourceColor = { good: T.green, accent: T.accentDeep }

function ChannelCard({ ch }) {
  const rows = [
    ['Items synced', `${ch.synced} / ${ch.total}`, T.ink],
    ['Errors', String(ch.errors), ch.errors === 0 ? T.green : T.warn],
    ['Last sync', ch.lastSync, T.ink],
  ]
  return (
    <div className="lt-card" style={{ background: T.raised, border: `1px solid ${T.border}`, borderRadius: 16, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 34, height: 34, borderRadius: 9, background: ch.color, border: ch.bordered ? `1px solid ${T.tileBorder2}` : 'none', color: ch.glyphColor, fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{ch.glyph}</span>
          <span style={{ fontFamily: T.display, fontWeight: 600, fontSize: 15, color: T.ink }}>{ch.name}</span>
        </div>
        <span style={pill('ok')}>Valid</span>
      </div>
      {rows.map(([label, value, color], i) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: T.muted2, padding: '6px 0', borderTop: i === 0 ? 'none' : `1px solid ${T.divider2}` }}>
          <span>{label}</span><b style={{ color }}>{value}</b>
        </div>
      ))}
    </div>
  )
}

export default function FeedsScreen({ v }) {
  return (
    <div className="lt-screen">
      <ScreenHeader
        title="Ad feeds"
        subtitle="Every bundle's components auto-append to the parent feed — so catalogs validate without manual mapping."
        right={<button className="lt-btn" style={ghostBtn} onClick={v.resyncFeeds}>Re-sync now</button>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 20 }}>
        {v.channels.map((ch) => <ChannelCard key={ch.id} ch={ch} />)}
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* schema mapping */}
        <div style={{ flex: 1.5, minWidth: 0, ...panel }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.divider}` }}>
            <span style={cardHeading}>Feed schema mapping</span>
            <div style={{ fontSize: 12, color: T.muted2, marginTop: 3 }}>Summer Essentials 3-Pack → parent feed item</div>
          </div>
          <div style={{ padding: '6px 8px' }}>
            <div style={{ display: 'flex', background: T.inset, fontSize: 10.5, fontWeight: 700, color: T.faint, textTransform: 'uppercase', letterSpacing: '.04em', padding: '9px 14px', borderRadius: 8, margin: 4 }}>
              <span style={{ flex: 1.2 }}>Feed field</span><span style={{ flex: 1.6 }}>Value</span><span style={{ width: 80, textAlign: 'right' }}>Source</span>
            </div>
            {v.feedSchema.map((r, i) => (
              <div key={r.field} style={{
                display: 'flex', alignItems: 'center', padding: '11px 14px', fontSize: 12.5, color: T.body,
                borderTop: i === 0 ? 'none' : `1px solid ${T.divider2}`,
                ...(r.highlight ? { background: T.accentTint, borderRadius: 8, margin: '2px 4px', borderTop: 'none' } : {}),
              }}>
                <span style={{ flex: 1.2, fontFamily: T.mono, color: r.highlight ? T.accentDeep : T.muted2 }}>{r.field}</span>
                <span style={{ flex: 1.6, fontWeight: 600, color: T.ink }}>{r.value}</span>
                <span style={{ width: 80, textAlign: 'right', fontSize: 11, fontWeight: 700, color: sourceColor[r.sourceKind] || T.green }}>{r.source}</span>
              </div>
            ))}
          </div>
        </div>

        {/* sync log */}
        <div style={{ flex: 1, minWidth: 0, background: T.raised, border: `1px solid ${T.border}`, borderRadius: 16, padding: '18px 20px' }}>
          <div style={{ ...cardHeading, marginBottom: 14 }}>Sync log</div>
          {v.syncLog.map((e, i) => (
            <div key={i} style={{ display: 'flex', gap: 11, alignItems: 'flex-start', padding: i === 0 ? '0 0 13px' : '13px 0', borderBottom: i < v.syncLog.length - 1 ? `1px solid ${T.divider}` : 'none' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor[e.dot], marginTop: 4, flex: 'none' }} />
              <div>
                <div style={{ fontSize: 12.5, color: T.ink, fontWeight: 600 }}>{e.title}</div>
                <div style={{ fontSize: 11.5, color: T.faint, marginTop: 2 }}>{e.meta}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
