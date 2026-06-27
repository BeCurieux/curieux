import { useStore } from './store.jsx'
import { T, serif, sans } from './theme.js'
import Icon from './icons.jsx'
import CaptainDashboard from './captain/Dashboard.jsx'
import CustomerBooking from './customer/Booking.jsx'

function Toggle() {
  const { view, setView } = useStore()
  const tab = (active) => ({
    border: 'none', borderRadius: 6, padding: '8px 14px', fontSize: 13, fontWeight: 600,
    fontFamily: sans, cursor: 'pointer',
    background: active ? T.coral : 'transparent',
    color: active ? '#fff' : T.tealText,
  })
  return (
    <div style={{ display: 'flex', background: 'rgba(244,239,230,0.1)', borderRadius: 9, padding: 4, gap: 4 }}>
      <button onClick={() => setView('captain')} style={tab(view === 'captain')}>Captain dashboard</button>
      <button onClick={() => setView('customer')} style={tab(view === 'customer')}>Customer booking</button>
    </div>
  )
}

function TopBar() {
  return (
    <div
      style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '16px 28px', background: T.ink, color: T.cream,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: serif, fontWeight: 700, fontSize: 20, letterSpacing: '0.01em' }}>
        <span style={{ width: 26, height: 26, borderRadius: 7, background: T.coral, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
          <Icon name="anchor" size={15} />
        </span>
        Skippr
      </div>
      <Toggle />
      <SaveStatus />
    </div>
  )
}

function SaveStatus() {
  const { persistent, hasDatabase } = useStore()
  const live = persistent
  return (
    <div style={{ fontSize: 12, color: live ? T.tealText : '#8b9491', letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: 7 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: live ? '#3fae8f' : '#c98a3d' }} />
      {live ? 'Saving to database' : hasDatabase ? 'Connecting…' : 'Demo mode · not saving'}
    </div>
  )
}

export default function App() {
  const { view, dbReady } = useStore()
  return (
    <div style={{ minHeight: '100vh', background: view === 'captain' ? T.pageSand : '#dfe7e4' }}>
      <TopBar />
      {!dbReady ? (
        <div style={{ padding: '80px 0', textAlign: 'center', color: T.muted, fontFamily: sans }}>Loading your charter…</div>
      ) : view === 'captain' ? (
        <CaptainDashboard />
      ) : (
        <CustomerBooking />
      )}
    </div>
  )
}
