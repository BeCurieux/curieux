const GRID = '2.2fr 0.8fr 1fr 1.1fr 1fr 0.8fr 1fr 1.1fr'

export default function ProductsScreen({ v }) {
  return (
    <div style={{ background: '#fff', border: '1px solid rgba(22,36,46,.07)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 1px 2px rgba(22,36,46,.04)' }}>
      <div style={{ padding: '16px 24px 13px', fontSize: 15, fontWeight: 700, color: '#16242E', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        All products
        <span style={{ fontSize: 12, fontWeight: 500, color: '#9AA7AE' }}>{v.productCount} products · click any for the full breakdown</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 8, padding: '11px 24px', background: '#FAF9F5', borderTop: '1px solid rgba(22,36,46,.06)', borderBottom: '1px solid rgba(22,36,46,.08)', fontSize: 11, fontWeight: 700, letterSpacing: '.04em', color: '#8B98A1', textTransform: 'uppercase' }}>
        <div>Product</div>
        <div style={{ textAlign: 'right' }}>Units</div>
        <div style={{ textAlign: 'right' }}>Revenue</div>
        <div style={{ textAlign: 'right' }}>Net profit</div>
        <div style={{ textAlign: 'right' }}>Margin</div>
        <div style={{ textAlign: 'right' }}>ROAS</div>
        <div style={{ textAlign: 'right' }}>Status</div>
        <div style={{ textAlign: 'right' }}>Cost data</div>
      </div>
      {v.productRows.map((p) => (
        <div key={p.id} onClick={p.open} className="wl-row" style={{ display: 'grid', gridTemplateColumns: GRID, gap: 8, padding: '13px 24px', borderBottom: '1px solid rgba(22,36,46,.05)', alignItems: 'center', cursor: 'pointer' }}>
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
          <div style={{ textAlign: 'right', fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5, fontWeight: 600, color: p.netColor }}>{p.marginText}</div>
          <div style={{ textAlign: 'right', fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5, fontWeight: 700, color: p.roasColor }}>{p.roasText}</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}><span style={p.pillStyle}>{p.pillText}</span></div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}><span style={p.confStyle}>{p.confText}</span></div>
        </div>
      ))}
    </div>
  )
}
