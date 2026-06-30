import { T } from '../lib/styles.js'
<<<<<<< Updated upstream
import { IconCube, IconChevron, IconSearch, IconBell, IconCheckSmall } from './Icons.jsx'

const dotColor = { warn: T.warn, amber: T.amber, good: T.green }

function Dropdown({ children, width = 240, right = 0 }) {
  return (
    <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right, width, background: T.raised, border: `1px solid ${T.border}`, borderRadius: 13, boxShadow: '0 18px 40px -16px rgba(42,36,32,.34)', zIndex: 60, overflow: 'hidden' }}>
      {children}
    </div>
  )
}
=======
import { IconCube, IconChevron, IconSearch, IconBell } from './Icons.jsx'
>>>>>>> Stashed changes

export default function Topbar({ v }) {
  const { store } = v
  return (
<<<<<<< Updated upstream
    <div style={{ position: 'relative', height: 62, background: T.raised, borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 22px', zIndex: 40 }}>
      {/* click-outside backdrop for the topbar menus */}
      {v.anyMenuOpen && <div onClick={v.closeMenus} style={{ position: 'fixed', inset: 0, zIndex: 30 }} />}

=======
    <div style={{ height: 62, background: T.raised, borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 22px' }}>
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream

        {/* store switcher */}
        <div style={{ position: 'relative', zIndex: 50 }}>
          <div className="lt-nav" onClick={v.toggleStoreMenu} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', background: v.storeMenuOpen ? T.accentTint : T.appBg, borderRadius: 10, fontSize: 12.5, color: T.body, fontWeight: 600, cursor: 'pointer' }}>
            <div style={{ width: 18, height: 18, borderRadius: 5, background: store.swatch }} />
            {store.name}
            <IconChevron />
          </div>
          {v.storeMenuOpen && (
            <Dropdown width={232} right="auto">
              <div style={{ padding: '8px' }}>
                {v.stores.map((s) => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 10px', borderRadius: 9, background: s.active ? T.accentTint : 'transparent' }}>
                    <div style={{ width: 18, height: 18, borderRadius: 5, background: s.swatch }} />
                    <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: T.ink }}>{s.name}</span>
                    {s.active && <IconCheckSmall color={T.green} />}
                  </div>
                ))}
              </div>
              <div onClick={v.connectStore} style={{ borderTop: `1px solid ${T.divider}`, padding: '11px 14px', fontSize: 12.5, fontWeight: 700, color: T.accent, cursor: 'pointer' }}>+ Connect another store</div>
            </Dropdown>
          )}
        </div>
      </div>

=======
        <div className="lt-nav" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', background: T.appBg, borderRadius: 10, fontSize: 12.5, color: T.body, fontWeight: 600, cursor: 'pointer' }}>
          <div style={{ width: 18, height: 18, borderRadius: 5, background: store.swatch }} />
          {store.name}
          <IconChevron />
        </div>
      </div>
>>>>>>> Stashed changes
      {/* right cluster */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: 230, padding: '8px 12px', background: T.appBg, borderRadius: 10 }}>
          <IconSearch />
<<<<<<< Updated upstream
          <input
            value={v.query}
            onChange={(e) => v.setQuery(e.target.value)}
            onFocus={() => { if (!v.isHome) v.go('home') }}
            placeholder="Search bundles, SKUs…"
            style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', outline: 'none', fontFamily: 'inherit', fontSize: 12.5, color: T.body }}
          />
          {v.query && <span onClick={v.clearQuery} style={{ cursor: 'pointer', fontSize: 14, color: T.faint, lineHeight: 1 }}>×</span>}
        </div>

        {/* notifications */}
        <div style={{ position: 'relative', zIndex: 50 }}>
          <div onClick={v.toggleBell} style={{ position: 'relative', cursor: 'pointer', display: 'flex' }}>
            <IconBell color={v.bellOpen ? T.accent : '#8a7d6e'} />
            {!v.bellSeen && <span style={{ position: 'absolute', top: -1, right: -1, width: 7, height: 7, borderRadius: '50%', background: T.accent, border: `1.5px solid ${T.raised}` }} />}
          </div>
          {v.bellOpen && (
            <Dropdown width={280}>
              <div style={{ padding: '12px 14px', borderBottom: `1px solid ${T.divider}`, fontFamily: T.display, fontWeight: 600, fontSize: 13.5, color: T.ink }}>Notifications</div>
              <div style={{ padding: '6px 8px' }}>
                {v.notifications.map((n, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor[n.dot], marginTop: 4, flex: 'none' }} />
                    <span style={{ fontSize: 12, color: T.body, lineHeight: 1.4 }}>{n.text}</span>
                  </div>
                ))}
              </div>
              <div onClick={() => { v.closeMenus(); v.nav.inventory.go() }} style={{ borderTop: `1px solid ${T.divider}`, padding: '11px 14px', fontSize: 12.5, fontWeight: 700, color: T.accent, cursor: 'pointer' }}>View inventory →</div>
            </Dropdown>
          )}
        </div>

=======
          <span style={{ fontSize: 12.5, color: T.faint }}>Search bundles, SKUs…</span>
        </div>
        <div style={{ position: 'relative' }}>
          <IconBell />
          <span style={{ position: 'absolute', top: -1, right: -1, width: 7, height: 7, borderRadius: '50%', background: T.accent, border: `1.5px solid ${T.raised}` }} />
        </div>
>>>>>>> Stashed changes
        <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#e9dcc9,#ecd9d2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: T.muted2 }}>
          {store.user.initials}
        </div>
      </div>
    </div>
  )
}
