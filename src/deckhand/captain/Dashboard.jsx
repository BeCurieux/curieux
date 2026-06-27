import { useStore } from '../store.jsx'
import { T, serif, sans } from '../theme.js'
import Icon from '../icons.jsx'
import { Avatar } from '../ui.jsx'
import TripsView from './TripsView.jsx'
import Calendar from './Calendar.jsx'
import Customers from './Customers.jsx'
import Payments from './Payments.jsx'
import Settings from './Settings.jsx'

const NAV = [
  { id: 'trips', label: 'Trips', icon: 'clipboard' },
  { id: 'calendar', label: 'Calendar', icon: 'calendar' },
  { id: 'customers', label: 'Customers', icon: 'users' },
  { id: 'payments', label: 'Payments', icon: 'dollar' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
]

function Sidebar() {
  const { section, setSection, captain } = useStore()
  return (
    <div
      style={{
        background: T.sidebar, color: '#aeb8b6', minHeight: 812, padding: '24px 16px',
        display: 'flex', flexDirection: 'column', gap: 4,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', marginBottom: 14 }}>
        <Avatar initials={captain.initials} />
        <div style={{ lineHeight: 1.25 }}>
          <div style={{ color: T.cream, fontWeight: 600, fontSize: 14 }}>{captain.name}</div>
          <div style={{ fontSize: 11, color: T.tealText }}>{captain.business}</div>
        </div>
      </div>

      {NAV.map((n) => {
        const active = section === n.id
        return (
          <button
            key={n.id}
            onClick={() => setSection(n.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', fontSize: 14,
              borderRadius: 8, border: 'none', cursor: 'pointer', textAlign: 'left',
              fontFamily: sans, width: '100%',
              background: active ? 'rgba(224,83,61,0.16)' : 'transparent',
              color: active ? T.cream : '#aeb8b6',
              fontWeight: active ? 600 : 400,
            }}
          >
            <span style={{ opacity: active ? 1 : 0.6, display: 'inline-flex' }}>
              <Icon name={n.icon} size={17} />
            </span>
            {n.label}
          </button>
        )
      })}

      <div
        style={{
          marginTop: 'auto', background: 'rgba(244,239,230,0.06)', borderRadius: 8,
          padding: '12px 14px', fontSize: 11.5, lineHeight: 1.5, color: '#8b9491',
        }}
      >
        <div style={{ color: T.tealText, fontWeight: 600, marginBottom: 3 }}>Booking page live</div>
        deckhand.com.au/{captain.slug}
      </div>
    </div>
  )
}

export default function CaptainDashboard() {
  const { section } = useStore()
  return (
    <div style={{ width: 1240, maxWidth: '100%', margin: '0 auto', background: T.pageSand, minHeight: 812 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '212px 1fr' }}>
        <Sidebar />
        <div style={{ padding: '30px 34px' }}>
          {section === 'trips' && <TripsView />}
          {section === 'calendar' && <Calendar />}
          {section === 'customers' && <Customers />}
          {section === 'payments' && <Payments />}
          {section === 'settings' && <Settings />}
        </div>
      </div>
    </div>
  )
}
