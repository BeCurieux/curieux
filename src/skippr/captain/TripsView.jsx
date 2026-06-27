import { useState } from 'react'
import { useStore } from '../store.jsx'
import { T, serif, sans, money, card } from '../theme.js'
import { RISK } from '../theme.js'
import Icon from '../icons.jsx'
import { Button, StatusPill, RiskDot, H1, SectionLabel } from '../ui.jsx'
import { credentialStatus } from '../services.js'
import NewTripModal from './NewTripModal.jsx'

const WEEK_BASE_DEPOSITS = 4950 // 7 trips on the books (prototype snapshot)

function Stat({ label, value, sub, valueColor = T.ink }) {
  return (
    <div style={{ ...card, padding: '18px 20px' }}>
      <div style={{ fontSize: 12, color: T.muted, letterSpacing: '0.04em', marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: serif, fontSize: 30, fontWeight: 700, color: valueColor }}>{value}</div>
      <div style={{ fontSize: 11.5, color: T.muted2, marginTop: 2 }}>{sub}</div>
    </div>
  )
}

function riskColor(risk) {
  return risk === 'high' ? T.riskHigh : risk === 'watch' ? T.riskWatch : T.riskOk
}

function SourceLinks() {
  const { captain } = useStore()
  const city = (captain.location || '').split(',')[0].trim()
  const links = [
    { label: 'BOM MetEye', href: 'http://www.bom.gov.au/australia/meteye/' },
    { label: 'WillyWeather', href: `https://www.willyweather.com.au/search.html?query=${encodeURIComponent(city)}` },
    { label: 'Windy', href: `https://www.windy.com/?${captain.lat},${captain.lng},8` },
  ]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 11, color: T.muted2 }}>Cross-check:</span>
      {links.map((l) => (
        <a
          key={l.label}
          href={l.href}
          target="_blank"
          rel="noreferrer"
          style={{
            fontSize: 11.5, fontWeight: 600, color: T.teal, textDecoration: 'none',
            border: `1px solid ${T.cardBorder}`, borderRadius: 20, padding: '4px 10px',
            display: 'inline-flex', alignItems: 'center', gap: 5,
          }}
        >
          {l.label}
          <Icon name="arrowRight" size={11} />
        </a>
      ))}
    </div>
  )
}

function WeatherCard() {
  const { forecast, forecastSource, forecastLive, weatherRule, weatherCancelled, cancelAndRebook } = useStore()
  const [busy, setBusy] = useState(false)

  const onCancel = async () => {
    setBusy(true)
    await cancelAndRebook('2026-06-27')
    setBusy(false)
  }

  return (
    <div
      style={{
        ...card, padding: '18px 20px', marginBottom: 18,
        borderColor: weatherCancelled ? T.okBorder : T.warnBorder,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Icon name={weatherCancelled ? 'checkCircle' : 'wind'} size={24} color={weatherCancelled ? T.teal : T.coral} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 14.5, color: T.ink }}>
              {weatherCancelled ? 'Saturday rebooked automatically' : 'BOM strong-wind warning — Saturday'}
            </div>
            <div style={{ fontSize: 12.5, color: T.body2, marginTop: 1 }}>
              {weatherCancelled
                ? '2 guests texted a one-tap link to pick a new open slot.'
                : 'SE winds 25–30 kt off Cairns. Cancel & Skippr rebooks every Saturday guest for you.'}
            </div>
          </div>
        </div>
        {weatherCancelled ? (
          <span style={{ background: T.teal, color: '#fff', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <Icon name="check" size={15} /> Rebook links sent
          </span>
        ) : (
          <Button variant="coral" onClick={onCancel} disabled={busy} style={{ borderRadius: 8, padding: '10px 16px', fontSize: 13, whiteSpace: 'nowrap' }}>
            {busy ? 'Sending…' : 'Cancel Sat & auto-rebook'}
          </Button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        {forecast.map((f) => {
          const r = RISK[f.risk]
          return (
            <div key={f.day} style={{ flex: 1, borderRadius: 10, padding: '11px 13px', background: r.bg, border: `1px solid ${r.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: T.ink }}>{f.day}</span>
                <RiskDot color={r.color} size={8} />
              </div>
              <div style={{ fontFamily: serif, fontSize: 21, fontWeight: 700, marginTop: 7, color: r.color }}>{f.gust} kt</div>
              <div style={{ fontSize: 11, color: T.muted, marginTop: 1 }}>{f.dir} · {f.swell.toFixed(1)} m swell</div>
            </div>
          )
        })}
      </div>

      <div style={{ fontSize: 11, color: T.muted2, marginTop: 12, letterSpacing: '0.01em', display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: forecastLive ? T.teal : T.muted2 }} />
        Source · {forecastSource} · checked hourly against your {weatherRule.gustKt} kt / {weatherRule.swellM} m cancel rule
        {forecastLive ? '' : ' (cached)'}
      </div>
      <SourceLinks />
    </div>
  )
}

function Compliance() {
  const { credentials } = useStore()
  return (
    <div style={{ ...card, padding: '14px 20px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 18 }}>
      <SectionLabel style={{ whiteSpace: 'nowrap' }}>AMSA compliance</SectionLabel>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', flex: 1 }}>
        {credentials.map((c) => {
          const { status, days } = credentialStatus(c)
          const expiring = status !== 'valid'
          const label = expiring
            ? `${c.type} · ${status === 'expired' ? 'expired' : `due ${days} days`}`
            : c.type
          return (
            <span
              key={c.id}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 600,
                padding: '6px 12px', borderRadius: 20,
                background: expiring ? T.amberBg : T.riskOkBg,
                color: expiring ? T.amber : T.teal,
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: expiring ? T.amberDot : T.teal }} />
              {label}
            </span>
          )
        })}
      </div>
    </div>
  )
}

function TripsList() {
  const { bookings, forecast, setSection } = useStore()
  const riskByDate = Object.fromEntries(forecast.map((f) => [f.date, f.risk]))

  return (
    <div style={{ ...card, overflow: 'hidden' }}>
      {bookings.map((b) => {
        const dot = b.status === 'open' ? T.dotOpen : riskColor(riskByDate[b.date] || 'ok')
        return (
          <div
            key={b.id}
            style={{
              display: 'grid', gridTemplateColumns: '88px 1fr 150px 130px 110px', alignItems: 'center',
              gap: 16, padding: '16px 22px', borderBottom: `1px solid ${T.hairline}`,
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: T.muted2, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{b.dow}</div>
              <div style={{ fontFamily: serif, fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{b.day}</div>
              <div style={{ fontSize: 11, color: T.muted }}>{b.time}</div>
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14.5, display: 'flex', alignItems: 'center', gap: 8 }}>
                <RiskDot color={dot} />{b.tripName}
                {b.isNew && <span style={{ fontSize: 10, fontWeight: 700, color: T.teal, background: T.riskOkBg, padding: '2px 6px', borderRadius: 5 }}>NEW</span>}
              </div>
              <div style={{ fontSize: 12.5, color: T.muted, marginTop: 2 }}>
                {b.guest ? `${b.guest} · party of ${b.party}` : 'Open slot'}
              </div>
            </div>
            <div style={{ fontSize: 13, color: T.body2 }}>{b.tripName ? (b.party ? `${b.party} aboard` : '—') : ''}</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: T.teal }}>{money(b.price)}</div>
              <div style={{ fontSize: 11.5, color: T.muted2 }}>
                {b.status === 'open' ? 'not booked' : `${money(b.deposit)} deposit paid`}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}><StatusPill status={b.status} /></div>
          </div>
        )
      })}
      <div
        onClick={() => setSection('calendar')}
        style={{ padding: '14px 22px', textAlign: 'center', fontSize: 13, color: T.teal, fontWeight: 600, cursor: 'pointer' }}
      >
        View full calendar →
      </div>
    </div>
  )
}

export default function TripsView() {
  const { bookings } = useStore()
  const [modal, setModal] = useState(false)

  const booked = bookings.filter((b) => b.status !== 'open')
  const newDeposits = bookings.filter((b) => b.isNew).reduce((s, b) => s + b.deposit, 0)
  const deposits = WEEK_BASE_DEPOSITS + newDeposits

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 22 }}>
        <div>
          <H1>This week</H1>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 2 }}>22 – 28 Jun · {booked.length} trips on the books</div>
        </div>
        <Button onClick={() => setModal(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <Icon name="plus" size={15} /> New trip
        </Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 22 }}>
        <Stat label="Deposits collected" value={money(deposits)} sub="this week · incl. GST" valueColor={T.teal} />
        <Stat label="Week fill rate" value="82%" sub="2 open slots left" />
        <Stat label="Kept vs OTAs" value="$1,240" sub="commission you didn't pay" valueColor={T.teal} />
      </div>

      <WeatherCard />
      <Compliance />
      <TripsList />

      {modal && <NewTripModal onClose={() => setModal(false)} />}
    </div>
  )
}
