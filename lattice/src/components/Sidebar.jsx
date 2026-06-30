import { T } from '../lib/styles.js'
import { IconHome, IconBundles, IconFeeds, IconSubs, IconInventory, IconPerformance, IconAnalytics, IconCheckSmall } from './Icons.jsx'

const ITEMS = [
  { key: 'home', label: 'Home', Icon: IconHome },
  { key: 'bundles', label: 'Bundles', Icon: IconBundles },
  { key: 'feeds', label: 'Ad feeds', Icon: IconFeeds },
  { key: 'subs', label: 'Subscriptions', Icon: IconSubs },
  { key: 'inventory', label: 'Inventory', Icon: IconInventory },
  { key: 'performance', label: 'Performance', Icon: IconPerformance },
  { key: 'analytics', label: 'Analytics', Icon: IconAnalytics },
]

export default function Sidebar({ v }) {
  return (
    <div style={{ width: 228, background: T.raised, borderRight: `1px solid ${T.border}`, padding: '18px 14px', minHeight: 822, display: 'flex', flexDirection: 'column' }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.07em', color: T.label, textTransform: 'uppercase', padding: '4px 12px 10px' }}>Store</div>

      {ITEMS.map(({ key, label, Icon }) => {
        const n = v.nav[key]
        return (
          <a key={key} className="lt-nav" style={n.style} onClick={n.go}>
            <span style={n.railStyle} />
            <Icon /> {label}
          </a>
        )
      })}

      <div style={{ flex: 1 }} />

      {/* atomic uninstall card */}
      <div style={{ background: T.appBg, borderRadius: 13, padding: 14, marginTop: 18 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.ink, marginBottom: 5 }}>Atomic uninstall</div>
        <div style={{ fontSize: 11, color: T.muted2, lineHeight: 1.45, marginBottom: 10 }}>Leaving? We purge every variant, asset &amp; theme block. No ghost products.</div>
        <div style={{ fontSize: 11, color: T.green, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
          <IconCheckSmall /> Theme stays clean
        </div>
      </div>
    </div>
  )
}
