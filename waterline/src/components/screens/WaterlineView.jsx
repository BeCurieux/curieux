export default function WaterlineView({ v }) {
  return (
    <div style={{ background: '#fff', border: '1px solid rgba(22,36,46,.07)', borderRadius: 18, padding: '24px 26px 18px', boxShadow: '0 1px 2px rgba(22,36,46,.04)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#16242E' }}>Every product, above or below break-even</div>
          <div style={{ fontSize: 12.5, color: '#8B98A1', marginTop: 2 }}>Bar height = net margin %. Anything sinking into the water is losing money on every sale.</div>
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: '#0E8F5E' }} /><span style={{ color: '#6A7780' }}>Above water</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: '#D6453F' }} /><span style={{ color: '#6A7780' }}>Underwater</span></div>
        </div>
      </div>

      <div style={{ position: 'relative', height: 344, marginTop: 8 }}>
        {/* water band */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: 170, height: 120, background: 'linear-gradient(180deg,rgba(28,76,107,0.07),rgba(28,76,107,0.22))', borderRadius: '0 0 6px 6px', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 1.5, background: 'rgba(28,76,107,0.45)' }} />
        </div>
        {/* waterline label */}
        <div style={{ position: 'absolute', right: 2, top: 170, transform: 'translateY(-50%)', background: '#16242E', color: '#fff', fontSize: 9.5, fontWeight: 700, letterSpacing: '.07em', padding: '3px 8px', borderRadius: 20, zIndex: 5 }}>WATERLINE · BREAK-EVEN</div>
        {/* columns */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'stretch', zIndex: 3 }}>
          {v.wlProducts.map((p) => (
            <div key={p.id} onClick={p.open} className="wl-col" style={{ flex: 1, position: 'relative', minWidth: 0, cursor: 'pointer', borderRadius: 8 }}>
              <div style={p.wlBarStyle} />
              <div style={p.wlLabelStyle}>{p.netText}</div>
              <div style={p.wlNameStyle}>{p.short}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
