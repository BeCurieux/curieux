// Inline sparkline (area + line) with a dashed zero baseline — ledger proof cards.

export default function Spark({ series, w = 132, h = 40, color = '#0E8F5E' }) {
  const min = Math.min(...series), max = Math.max(...series), span = (max - min) || 1
  const pts = series.map((v, i) => {
    const x = (i / (series.length - 1)) * w
    const y = h - ((v - min) / span) * h
    return [x, y]
  })
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ')
  const area = line + ' L' + w + ' ' + h + ' L0 ' + h + ' Z'
  const zy = min <= 0 && max >= 0 ? h - ((0 - min) / span) * h : null
  const gid = 'sg' + color.replace('#', '')

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.22} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {zy !== null && <line x1="0" y1={zy} x2={w} y2={zy} stroke="#C13A34" strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />}
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={3} fill={color} />
    </svg>
  )
}
