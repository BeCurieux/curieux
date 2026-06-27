import { useStore } from '../store.jsx'
import { T, serif, sans, money, card } from '../theme.js'
import Icon from '../icons.jsx'
import { H1, SectionLabel } from '../ui.jsx'
import { credentialStatus } from '../services.js'

const field = {
  padding: '10px 12px', fontSize: 14, border: `1px solid ${T.cardBorder}`,
  borderRadius: 9, fontFamily: sans, color: T.ink, background: T.white, outline: 'none', width: '100%',
}

function Block({ title, sub, children }) {
  return (
    <div style={{ ...card, padding: 22, marginBottom: 18 }}>
      <SectionLabel style={{ marginBottom: 4 }}>{title}</SectionLabel>
      {sub && <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 16 }}>{sub}</div>}
      {children}
    </div>
  )
}

export default function Settings() {
  const { captain, updateCaptain, weatherRule, updateWeatherRule, tripTypes, updateTripType, vessel, credentials } = useStore()

  return (
    <div>
      <H1>Settings</H1>
      <div style={{ fontSize: 13, color: T.muted, margin: '2px 0 22px' }}>Booking page, weather rules, trips & compliance</div>

      <Block title="Booking page" sub="The public link anglers use to book direct — no OTA commission.">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 14, color: T.muted }}>skippr.com.au/</span>
          <input style={{ ...field, maxWidth: 220 }} value={captain.slug} onChange={(e) => updateCaptain({ slug: e.target.value.replace(/\s+/g, '-').toLowerCase() })} />
          <a href="#" onClick={(e) => e.preventDefault()} style={{ fontSize: 13, color: T.teal, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Icon name="arrowRight" size={14} /> Preview
          </a>
        </div>
      </Block>

      <Block title="Weather cancel rule" sub="Trips auto-flag as risky once the forecast breaches these thresholds. Changes apply to the conditions card immediately.">
        <div style={{ display: 'flex', gap: 24 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12.5, color: T.muted, fontWeight: 600 }}>Gust threshold (kt)</span>
            <input style={{ ...field, width: 120 }} type="number" value={weatherRule.gustKt} onChange={(e) => updateWeatherRule({ gustKt: Number(e.target.value) || 0 })} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12.5, color: T.muted, fontWeight: 600 }}>Swell threshold (m)</span>
            <input style={{ ...field, width: 120 }} type="number" step="0.1" value={weatherRule.swellM} onChange={(e) => updateWeatherRule({ swellM: Number(e.target.value) || 0 })} />
          </label>
        </div>
      </Block>

      <Block title="Trip types" sub="Price is GST-inclusive. The deposit is taken at booking; the balance is paid at the marina.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {tripTypes.map((t) => (
            <div key={t.id} style={{ border: `1px solid ${T.hairline}`, borderRadius: 10, padding: 14 }}>
              <div style={{ fontFamily: serif, fontSize: 16, fontWeight: 600, marginBottom: 10 }}>{t.name}</div>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                <label style={{ fontSize: 12, color: T.muted }}>
                  Price<br />
                  <input style={{ ...field, width: 120, marginTop: 4 }} type="number" value={t.price} onChange={(e) => updateTripType(t.id, { price: Number(e.target.value) || 0 })} />
                </label>
                <label style={{ fontSize: 12, color: T.muted }}>
                  Deposit<br />
                  <input style={{ ...field, width: 120, marginTop: 4 }} type="number" value={t.deposit} onChange={(e) => updateTripType(t.id, { deposit: Number(e.target.value) || 0 })} />
                </label>
                <label style={{ fontSize: 12, color: T.muted, flex: 1, minWidth: 220 }}>
                  What to bring (shown on confirmation)<br />
                  <input style={{ ...field, marginTop: 4 }} value={t.whatToBring} onChange={(e) => updateTripType(t.id, { whatToBring: e.target.value })} />
                </label>
              </div>
            </div>
          ))}
        </div>
      </Block>

      <Block title="Vessel & AMSA compliance" sub="Expiry reminders are scheduled before each credential lapses.">
        <div style={{ fontSize: 13, color: T.body, marginBottom: 14 }}>
          <strong>{vessel.name}</strong> · {vessel.capacity} pax · {vessel.homeMarina}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {credentials.map((c) => {
            const { status, days } = credentialStatus(c)
            const expiring = status !== 'valid'
            return (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: 8, background: expiring ? T.amberBg : T.riskOkBg }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: expiring ? T.amber : T.teal }}>{c.type}</span>
                <span style={{ fontSize: 12.5, color: expiring ? T.amber : T.teal }}>
                  {status === 'expired' ? 'Expired' : status === 'expiring' ? `Due in ${days} days` : `Valid · expires ${c.expiry}`}
                </span>
              </div>
            )
          })}
        </div>
      </Block>
    </div>
  )
}
