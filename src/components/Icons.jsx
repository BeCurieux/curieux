// Inline feather-style icons (1.9–2.2 stroke) used across the app.
const S = (props) => ({ width: props.size || 17, height: props.size || 17, viewBox: '0 0 24 24', fill: 'none', stroke: props.color || 'currentColor', strokeWidth: props.sw || 1.9 })

export const IconGrid = (p) => (<svg {...S(p)}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>)
export const IconWaves = (p) => (<svg {...S(p)}><path d="M2 12c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2" /><path d="M2 17c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2" /></svg>)
export const IconBolt = (p) => (<svg width={p.size || 17} height={p.size || 17} viewBox="0 0 24 24" fill={p.fill || 'currentColor'} stroke="none"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" /></svg>)
export const IconBoltStroke = (p) => (<svg {...S(p)}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" /></svg>)
export const IconBox = (p) => (<svg {...S(p)}><path d="M21 8l-9-5-9 5 9 5 9-5z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" /></svg>)
export const IconList = (p) => (<svg {...S(p)}><line x1="8" y1="7" x2="20" y2="7" /><line x1="8" y1="12" x2="20" y2="12" /><line x1="8" y1="17" x2="20" y2="17" /><circle cx="4" cy="7" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="17" r="1" /></svg>)
export const IconCoin = (p) => (<svg {...S(p)}><circle cx="12" cy="12" r="9" /><path d="M14.5 9.5a2.5 2.5 0 0 0-2.5-1.5c-1.4 0-2.5.8-2.5 2s1.1 1.6 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2a2.5 2.5 0 0 1-2.5-1.5" /><path d="M12 6v1.5M12 16.5V18" /></svg>)
export const IconBell = (p) => (<svg {...S(p)}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>)
export const IconCard = (p) => (<svg {...S(p)}><rect x="2" y="5" width="20" height="14" rx="2.5" /><path d="M2 10h20" /></svg>)
export const IconGear = (p) => (<svg {...S(p)} strokeWidth={p.sw || 2}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>)
export const IconAlert = (p) => (<svg width={p.size || 20} height={p.size || 20} viewBox="0 0 24 24" fill="none" stroke={p.color || '#FF8A82'} strokeWidth={p.sw || 2.1}><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>)
export const IconX = (p) => (<svg width={p.size || 18} height={p.size || 18} viewBox="0 0 24 24" fill="none" stroke={p.color || 'currentColor'} strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>)
export const IconCheck = (p) => (<svg width={p.size || 17} height={p.size || 17} viewBox="0 0 24 24" fill="none" stroke={p.color || 'currentColor'} strokeWidth={p.sw || 2}><path d="M20 6 9 17l-5-5" /></svg>)
export const IconArrowRight = (p) => (<svg width={p.size || 16} height={p.size || 16} viewBox="0 0 24 24" fill="none" stroke={p.color || '#9AA7AE'} strokeWidth="2.2"><path d="M5 12h14M13 6l6 6-6 6" /></svg>)
export const IconChevronDown = (p) => (<svg width={p.size || 11} height={p.size || 11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="M6 9l6 6 6-6" /></svg>)
export const IconInfo = (p) => (<svg width={p.size || 13} height={p.size || 13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="9" /><path d="M12 16v-5M12 8h.01" /></svg>)
export const IconClock = (p) => (<svg width={p.size || 18} height={p.size || 18} viewBox="0 0 24 24" fill="none" stroke={p.color || '#A8770F'} strokeWidth="2.1"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>)
export const IconSparkles = (p) => (<svg width={p.size || 16} height={p.size || 16} viewBox="0 0 24 24" fill="none" stroke={p.color || '#0E8F5E'} strokeWidth="2"><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l2.5 2.5M16.5 16.5 19 19M19 5l-2.5 2.5M7.5 16.5 5 19" /></svg>)
export const IconBars = (p) => (<svg width={p.size || 16} height={p.size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18" /><rect x="6" y="5" width="3" height="6" /><rect x="11" y="9" width="3" height="6" /><rect x="16" y="13" width="3" height="4" /></svg>)
export const IconRows = (p) => (<svg width={p.size || 16} height={p.size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>)
export const IconLock = (p) => (<svg width={p.size || 18} height={p.size || 18} viewBox="0 0 24 24" fill="none" stroke={p.color || '#0E8F5E'} strokeWidth="2.1"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>)

// Brand mark: rounded green→teal tile with a darker "waterline" band.
export const Logo = ({ size = 34, radius = 9 }) => (
  <div style={{ width: size, height: size, borderRadius: radius, background: 'linear-gradient(150deg,#1BB377,#0E8F5E)', position: 'relative', overflow: 'hidden', flexShrink: 0, boxShadow: size > 30 ? '0 2px 8px rgba(14,143,94,.4)' : 'none' }}>
    <div style={{ position: 'absolute', left: 0, right: 0, top: '55%', height: '45%', background: 'linear-gradient(180deg,#1C4C6B,#0E2B40)' }} />
    <div style={{ position: 'absolute', left: 0, right: 0, top: '53%', height: '2px', background: 'rgba(255,255,255,.85)' }} />
  </div>
)
