import { useStore } from '../store.jsx'
import { T, serif, money, card } from '../theme.js'
import { RISK } from '../theme.js'
import { H1, RiskDot, StatusPill } from '../ui.jsx'

// Visible week: Mon 22 Jun → Sun 28 Jun 2026 (matches the dashboard snapshot).
const DAYS = [
  { dow: 'Mon', day: '22', date: '2026-06-22' },
  { dow: 'Tue', day: '23', date: '2026-06-23' },
  { dow: 'Wed', day: '24', date: '2026-06-24' },
  { dow: 'Thu', day: '25', date: '2026-06-25' },
  { dow: 'Fri', day: '26', date: '2026-06-26' },
  { dow: 'Sat', day: '27', date: '2026-06-27' },
  { dow: 'Sun', day: '28', date: '2026-06-28' },
]

export default function Calendar() {
  const { bookings, forecast } = useStore()
  const riskByDate = Object.fromEntries(forecast.map((f) => [f.date, f.risk]))

  return (
    <div>
      <H1>Calendar</H1>
      <div style={{ fontSize: 13, color: T.muted, margin: '2px 0 22px' }}>Week of 22 – 28 June 2026</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 10 }}>
        {DAYS.map((d) => {
          const dayBookings = bookings.filter((b) => b.date === d.date)
          const risk = riskByDate[d.date]
          const r = risk ? RISK[risk] : null
          return (
            <div key={d.date} style={{ ...card, padding: 0, overflow: 'hidden', minHeight: 220 }}>
              <div
                style={{
                  padding: '10px 12px', borderBottom: `1px solid ${T.hairline}`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: r ? r.bg : T.white,
                }}
              >
                <div>
                  <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.muted2 }}>{d.dow}</div>
                  <div style={{ fontFamily: serif, fontSize: 18, fontWeight: 700, lineHeight: 1 }}>{d.day}</div>
                </div>
                {r && <RiskDot color={r.color} size={8} />}
              </div>
              <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {dayBookings.length === 0 && (
                  <div style={{ fontSize: 11.5, color: T.muted2, padding: '8px 4px' }}>No trips</div>
                )}
                {dayBookings.map((b) => (
                  <div key={b.id} style={{ border: `1px solid ${T.hairline}`, borderRadius: 8, padding: '8px 9px' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T.ink, marginBottom: 3 }}>{b.tripName}</div>
                    <div style={{ fontSize: 10.5, color: T.muted, marginBottom: 6 }}>{b.time} · {b.party ? `${b.party} pax` : 'open'}</div>
                    <StatusPill status={b.status} />
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ fontSize: 12, color: T.muted, marginTop: 16 }}>
        Day headers are tinted by forecast risk · trips flagged on high-risk days feed the conditions card.
      </div>
    </div>
  )
}
