const GRID = '2.4fr 0.9fr 1fr 1.1fr 1.5fr 1.3fr 1fr'

export default function TriageView({ v }) {
  return (
    <div style={{ background: '#fff', border: '1px solid rgba(22,36,46,.07)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 1px 2px rgba(22,36,46,.04)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 8, padding: '13px 24px', background: '#FAF9F5', borderBottom: '1px solid rgba(22,36,46,.08)', fontSize: 11, fontWeight: 700, letterSpacing: '.04em', color: '#8B98A1', textTransform: 'uppercase' }}>
        <div onClick={v.sortName} className="wl-sorth" style={{ cursor: 'pointer' }}>Product {v.arrows.name}</div>
        <div onClick={v.sortUnits} className="wl-sorth" style={{ cursor: 'pointer', textAlign: 'right' }}>Units {v.arrows.units}</div>
        <div onClick={v.sortRev} className="wl-sorth" style={{ cursor: 'pointer', textAlign: 'right' }}>Revenue {v.arrows.rev}</div>
        <div onClick={v.sortNet} className="wl-sorth" style={{ cursor: 'pointer', textAlign: 'right' }}>Net profit {v.arrows.net}</div>
        <div onClick={v.sortMargin} className="wl-sorth" style={{ cursor: 'pointer', textAlign: 'center' }}>Margin {v.arrows.margin}</div>
        <div>Top leak</div>
        <div style={{ textAlign: 'right' }}>Status</div>
      </div>
      {v.triProducts.map((p) => (
        <div key={p.id} onClick={p.open} className="wl-row" style={{ display: 'grid', gridTemplateColumns: GRID, gap: 8, padding: '14px 24px', borderBottom: '1px solid rgba(22,36,46,.05)', alignItems: 'center', cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
            <span style={p.dotStyle} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: '#16242E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
              <div style={{ fontSize: 11.5, color: '#9AA7AE' }}>{p.cat}</div>
            </div>
          </div>
          <div style={{ textAlign: 'right', fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: '#6A7780' }}>{p.unitsText}</div>
          <div style={{ textAlign: 'right', fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: '#16242E' }}>{p.revText}</div>
          <div style={{ textAlign: 'right', fontFamily: "'JetBrains Mono',monospace", fontSize: 13.5, fontWeight: 700, color: p.netColor }}>{p.netText}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ flex: 1, height: 7, background: '#EDEBE4', borderRadius: 5, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1, background: 'rgba(22,36,46,.18)' }} />
              <div style={p.marginBarStyle} />
            </div>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 600, color: p.netColor, width: 42, textAlign: 'right' }}>{p.pctText}</span>
          </div>
          <div style={{ fontSize: 12.5, color: '#6A7780' }}>{p.leakText}</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}><span style={p.pillStyle}>{p.pillText}</span></div>
        </div>
      ))}
    </div>
  )
}
