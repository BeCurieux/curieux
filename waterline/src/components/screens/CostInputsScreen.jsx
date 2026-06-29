export default function CostInputsScreen({ v }) {
  const GRID = '2fr 1.5fr 0.9fr 0.9fr 0.9fr 1fr'
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 20 }}>
        <div style={{ background: '#fff', border: '1px solid rgba(22,36,46,.07)', borderRadius: 15, padding: '18px 19px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#8B98A1' }}>Cost data confidence</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 27, fontWeight: 700, color: '#0E8F5E' }}>{v.costConfidence}</div>
            <div style={{ fontSize: 12, color: '#6A7780' }}>of margin inputs trustworthy</div>
          </div>
          <div style={{ height: 7, background: '#EDEBE4', borderRadius: 5, marginTop: 11, overflow: 'hidden' }}><div style={{ height: '100%', width: v.costConfidence, background: 'linear-gradient(90deg,#1BB377,#0E8F5E)', borderRadius: 5 }} /></div>
        </div>
        <div style={{ background: '#fff', border: '1px solid rgba(22,36,46,.07)', borderRadius: 15, padding: '18px 19px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#8B98A1' }}>Verified · estimated</div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 27, fontWeight: 700, color: '#16242E', marginTop: 8 }}>{v.verifiedCount} · {v.estimatedCount}</div>
          <div style={{ fontSize: 12, color: '#6A7780', marginTop: 6 }}>products with confirmed vs inferred costs</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg,#FBE8E6,#F8DAD7)', border: '1px solid rgba(214,69,63,.25)', borderRadius: 15, padding: '18px 19px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#A23A35' }}>Missing costs</div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 27, fontWeight: 700, color: '#C13A34', marginTop: 8 }}>{v.missingCount}</div>
          <div style={{ fontSize: 12, color: '#A23A35', marginTop: 6, fontWeight: 600 }}>margins for these are best-guess only</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.7fr', gap: 18, alignItems: 'start' }}>
        {/* sources */}
        <div style={{ background: '#fff', border: '1px solid rgba(22,36,46,.07)', borderRadius: 18, padding: '20px 22px', boxShadow: '0 1px 2px rgba(22,36,46,.04)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#16242E' }}>Connected data sources</div>
          <div style={{ fontSize: 12.5, color: '#9AA7AE', marginTop: 2, marginBottom: 16 }}>Where Waterline pulls every cost from.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            {v.sources.map((s) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={s.iconStyle}>{s.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: '#16242E', display: 'flex', alignItems: 'center', gap: 8 }}>{s.name}<span style={s.pillStyle}>{s.pillText}</span></div>
                  <div style={{ fontSize: 11.5, color: '#9AA7AE', marginTop: 2 }}>{s.detail}</div>
                </div>
                <button style={s.btnStyle}>{s.btnText}</button>
              </div>
            ))}
          </div>
        </div>
        {/* cost table */}
        <div style={{ background: '#fff', border: '1px solid rgba(22,36,46,.07)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 1px 2px rgba(22,36,46,.04)' }}>
          <div style={{ padding: '16px 22px 13px', fontSize: 15, fontWeight: 700, color: '#16242E', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            Per-unit costs
            <span style={{ fontSize: 12, fontWeight: 500, color: '#9AA7AE' }}>Adjust COGS — margins recalc live</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 8, padding: '10px 22px', background: '#FAF9F5', borderTop: '1px solid rgba(22,36,46,.06)', borderBottom: '1px solid rgba(22,36,46,.06)', fontSize: 11, fontWeight: 700, letterSpacing: '.03em', color: '#8B98A1', textTransform: 'uppercase' }}>
            <div>Product</div><div style={{ textAlign: 'center' }}>COGS / unit</div><div style={{ textAlign: 'right' }}>Ship</div><div style={{ textAlign: 'right' }}>Ads</div><div style={{ textAlign: 'right' }}>Margin</div><div style={{ textAlign: 'right' }}>Source</div>
          </div>
          {v.costRows.map((c) => (
            <div key={c.id} style={{ display: 'grid', gridTemplateColumns: GRID, gap: 8, padding: '12px 22px', borderBottom: '1px solid rgba(22,36,46,.05)', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <span style={c.dotStyle} />
                <div style={{ fontSize: 13, fontWeight: 600, color: '#16242E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                <button onClick={c.dec} style={v.stepBtn}>−</button>
                <span style={c.cogsEditedStyle}>{c.cogsText}</span>
                <button onClick={c.inc} style={v.stepBtn}>+</button>
              </div>
              <div style={{ textAlign: 'right', fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5, color: '#6A7780' }}>{c.shipText}</div>
              <div style={{ textAlign: 'right', fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5, color: '#6A7780' }}>{c.adText}</div>
              <div style={{ textAlign: 'right', fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700, color: c.marginColor }}>{c.marginText}</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}><span style={c.confStyle}>{c.confText}</span></div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
