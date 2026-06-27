import { useStore } from '../store.jsx'
import { T, sans, card } from '../theme.js'
import Icon from '../icons.jsx'
import { H1, Avatar, Button, SectionLabel } from '../ui.jsx'

function timeAgo(iso) {
  const s = (Date.now() - new Date(iso)) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

function ActivityPanel() {
  const { activity } = useStore()
  return (
    <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T.hairline}` }}>
        <SectionLabel>Message activity</SectionLabel>
      </div>
      {activity.length === 0 ? (
        <div style={{ padding: '22px 18px', fontSize: 13, color: T.muted2 }}>
          No messages yet. Confirmations, rebooking links and review nudges land here as they go out.
        </div>
      ) : (
        activity.map((m, i) => (
          <div key={i} style={{ padding: '12px 18px', borderBottom: `1px solid ${T.hairline}`, display: 'flex', gap: 12 }}>
            <Icon name={m.channel === 'sms' ? 'send' : 'bell'} size={16} color={T.teal} style={{ marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: T.ink }}>
                  {m.subject} <span style={{ color: T.muted2, fontWeight: 400 }}>· {m.channel.toUpperCase()} → {m.to}</span>
                </span>
                <span style={{ fontSize: 11, color: T.muted2, whiteSpace: 'nowrap' }}>
                  {m.mock ? 'queued' : 'sent'} · {timeAgo(m.at)}
                </span>
              </div>
              <div style={{ fontSize: 12, color: T.body2, marginTop: 3, lineHeight: 1.5 }}>{m.body}</div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

export default function Customers() {
  const { bookings, requestReview } = useStore()
  const customers = bookings.filter((b) => b.status !== 'open')

  return (
    <div>
      <H1>Customers</H1>
      <div style={{ fontSize: 13, color: T.muted, margin: '2px 0 22px' }}>{customers.length} guests this week</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 18, alignItems: 'start' }}>
        <div style={{ ...card, overflow: 'hidden' }}>
          {customers.map((b) => (
            <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderBottom: `1px solid ${T.hairline}` }}>
              <Avatar initials={(b.guest || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()} size={36} fontSize={13} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{b.guest}</div>
                <div style={{ fontSize: 12, color: T.muted }}>
                  {b.tripName} · party of {b.party}{b.phone ? ` · ${b.phone}` : ''}
                </div>
              </div>
              {b.reviewRequested ? (
                <span style={{ fontSize: 12, color: T.teal, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Icon name="check" size={14} /> Review sent
                </span>
              ) : (
                <Button variant="outline" onClick={() => requestReview(b)} style={{ padding: '8px 12px', fontSize: 12.5 }}>
                  Request review
                </Button>
              )}
            </div>
          ))}
        </div>

        <ActivityPanel />
      </div>
    </div>
  )
}
