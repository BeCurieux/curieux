// Renders absolutely-positioned waterfall steps from compute.waterfall().
export default function Waterfall({ steps, zeroStyle, height = 268 }) {
  return (
    <div style={{ position: 'relative', height }}>
      <div style={zeroStyle} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'stretch' }}>
        {steps.map((s, i) => (
          <div key={i} style={{ flex: 1, position: 'relative' }}>
            <div style={s.style} />
            <div style={s.amtStyle}>{s.amtText}</div>
            <div style={s.xStyle}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
