import Waterfall from '../Waterfall.jsx'
import { IconAlert } from '../Icons.jsx'

export default function LeakView({ v }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 18 }}>
      <div style={{ background: '#fff', border: '1px solid rgba(22,36,46,.07)', borderRadius: 18, padding: '22px 26px 16px', boxShadow: '0 1px 2px rgba(22,36,46,.04)' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#16242E' }}>Where every revenue dollar goes</div>
        <div style={{ fontSize: 12.5, color: '#8B98A1', marginTop: 2, marginBottom: 8 }}>Store-wide contribution waterfall, {v.rangeLabel}.</div>
        <Waterfall steps={v.aggSteps} zeroStyle={v.aggZeroStyle} height={268} />
      </div>

      <div style={{ background: '#fff', border: '1px solid rgba(22,36,46,.07)', borderRadius: 18, padding: '22px 24px', boxShadow: '0 1px 2px rgba(22,36,46,.04)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#16242E' }}>Biggest margin leaks</div>
        <div style={{ fontSize: 12.5, color: '#8B98A1', marginTop: 2, marginBottom: 16 }}>Share of revenue, excluding product cost.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
          {v.leakBuckets.map((b, i) => (
            <div key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#16242E' }}>{b.label}</span>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5, color: '#6A7780' }}>{b.amtText} · <span style={{ fontWeight: 700, color: b.pctColor }}>{b.pctText}</span></span>
              </div>
              <div style={{ height: 9, background: '#EDEBE4', borderRadius: 6, overflow: 'hidden' }}>
                <div style={b.barStyle} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ marginTop: 18, background: '#FBE8E6', border: '1px solid rgba(214,69,63,.2)', borderRadius: 12, padding: '13px 15px', display: 'flex', gap: 11, alignItems: 'flex-start' }}>
          <span style={{ flexShrink: 0, marginTop: 1 }}><IconAlert color="#C13A34" size={18} /></span>
          <div style={{ fontSize: 12.5, lineHeight: 1.5, color: '#7A322E' }}>{v.leakHeadline}</div>
        </div>
      </div>
    </div>
  )
}
