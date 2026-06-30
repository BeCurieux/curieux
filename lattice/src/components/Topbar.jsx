import { T } from '../lib/styles.js'
import { IconCube, IconChevron, IconSearch, IconBell } from './Icons.jsx'

export default function Topbar({ v }) {
  const { store } = v
  return (
    <div style={{ height: 62, background: T.raised, borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 22px' }}>
      {/* left cluster */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: `linear-gradient(135deg,${T.accent},${T.rose})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconCube />
          </div>
          <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
            <span style={{ fontFamily: T.display, fontWeight: 700, fontSize: 17, color: T.ink, letterSpacing: '-.01em' }}>Lattice</span>
            <span style={{ fontSize: 9, color: T.faint, fontWeight: 600, letterSpacing: '.02em', marginTop: 2 }}>by Sounding Labs</span>
          </span>
        </div>
        <div className="lt-nav" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', background: T.appBg, borderRadius: 10, fontSize: 12.5, color: T.body, fontWeight: 600, cursor: 'pointer' }}>
          <div style={{ width: 18, height: 18, borderRadius: 5, background: store.swatch }} />
          {store.name}
          <IconChevron />
        </div>
      </div>
      {/* right cluster */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: 230, padding: '8px 12px', background: T.appBg, borderRadius: 10 }}>
          <IconSearch />
          <span style={{ fontSize: 12.5, color: T.faint }}>Search bundles, SKUs…</span>
        </div>
        <div style={{ position: 'relative' }}>
          <IconBell />
          <span style={{ position: 'absolute', top: -1, right: -1, width: 7, height: 7, borderRadius: '50%', background: T.accent, border: `1.5px solid ${T.raised}` }} />
        </div>
        <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#e9dcc9,#ecd9d2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: T.muted2 }}>
          {store.user.initials}
        </div>
      </div>
    </div>
  )
}
