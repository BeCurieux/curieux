import { useState } from 'react'
import { useStore } from '../store.jsx'
import { T, serif, sans, money } from '../theme.js'
import Icon from '../icons.jsx'
import { Avatar } from '../ui.jsx'
import { createDeposit } from '../services.js'

const STEPS = ['trips', 'date', 'pay', 'done']

function Header() {
  const { captain } = useStore()
  return (
    <div style={{ background: T.ink, color: T.cream, padding: '18px 22px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar initials={captain.initials} size={46} fontSize={16} />
        <div>
          <div style={{ fontFamily: serif, fontWeight: 700, fontSize: 18 }}>{captain.business}</div>
          <div style={{ fontSize: 12, color: '#aeb8b6', display: 'flex', alignItems: 'center', gap: 5 }}>
            {captain.name} · {captain.location} ·
            <Icon name="star" size={12} color="#e0a93d" style={{ display: 'inline-block' }} />
            {captain.rating} ({captain.reviewCount})
          </div>
        </div>
      </div>
    </div>
  )
}

function Progress({ step }) {
  const dots = [
    { id: 'trips', label: 'Pick a trip' },
    { id: 'date', label: 'Choose a date' },
    { id: 'pay', label: 'Deposit & waiver' },
    { id: 'done', label: 'Confirmed' },
  ]
  const idx = STEPS.indexOf(step)
  return (
    <div style={{ display: 'flex', gap: 6, padding: '12px 18px', background: T.phoneSand, borderBottom: `1px solid ${T.hairline}` }}>
      {dots.map((d, i) => (
        <div key={d.id} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= idx ? (i === idx ? T.coral : T.teal) : '#d8d2c4' }} title={d.label} />
      ))}
    </div>
  )
}

const field = {
  width: '100%', padding: '12px 14px', fontSize: 14, border: `1px solid ${T.cardBorder}`,
  borderRadius: 11, fontFamily: sans, color: T.ink, background: T.white, outline: 'none',
}

export default function CustomerBooking() {
  const { tripTypes, slots, createBooking, captain } = useStore()
  const [step, setStep] = useState('trips')
  const [tripId, setTripId] = useState(null)
  const [slotId, setSlotId] = useState(null)
  const [party, setParty] = useState(2)
  const [waiver, setWaiver] = useState(true)
  const [paying, setPaying] = useState(false)
  const [cust, setCust] = useState({ name: '', email: '', phone: '' })

  const trip = tripTypes.find((t) => t.id === tripId) || null
  const slot = slots.find((s) => s.id === slotId) || null
  const maxParty = trip?.capacity || 8

  const reset = () => { setStep('trips'); setTripId(null); setSlotId(null); setParty(2); setCust({ name: '', email: '', phone: '' }) }

  const pay = async () => {
    if (!trip || !waiver || paying) return
    setPaying(true)
    await createDeposit({ amount: trip.deposit, tripName: trip.name, customer: cust })
    await createBooking({ tripTypeId: trip.id, slot, party, customer: cust })
    setPaying(false)
    setStep('done')
  }

  // Sticky CTA per step (README §5)
  let cta = null
  if (step === 'date') {
    cta = { label: slot ? 'Continue to deposit →' : 'Select a date', disabled: !slot, action: () => slot && setStep('pay') }
  } else if (step === 'pay') {
    cta = { label: paying ? 'Processing…' : `Pay ${money(trip?.deposit || 0)} deposit & sign`, disabled: !waiver || paying, action: pay }
  }

  return (
    <div style={{ background: '#dfe7e4', minHeight: 'calc(100vh - 60px)', display: 'flex', justifyContent: 'center', padding: '24px 12px 40px' }}>
      <div style={{ width: 430, maxWidth: '100%', background: T.phoneSand, borderRadius: 18, overflow: 'hidden', boxShadow: '0 24px 50px -24px rgba(20,32,46,0.45)', display: 'flex', flexDirection: 'column', minHeight: 700 }}>
        <Header />
        <Progress step={step} />

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* STEP 1 — trips */}
          {step === 'trips' && (
            <div style={{ padding: '18px 18px 22px' }}>
              <div style={{ fontSize: 13, color: T.muted, marginBottom: 14 }}>Pick your trip</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {tripTypes.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => { setTripId(t.id); setParty(Math.min(2, t.capacity)); setStep('date') }}
                    style={{ border: `1px solid ${T.cardBorder}`, background: T.white, borderRadius: 14, padding: 16, cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <div style={{ fontWeight: 700, fontSize: 16, fontFamily: serif }}>{t.name}</div>
                      <div style={{ fontWeight: 700, fontSize: 16, color: T.teal }}>{money(t.price)}</div>
                    </div>
                    {t.tag && (
                      <span style={{ display: 'inline-block', background: T.rebookingBg, color: T.coral, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 5, marginBottom: 8 }}>{t.tag}</span>
                    )}
                    <div style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.5 }}>{t.durationLabel} · {t.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2 — date */}
          {step === 'date' && (
            <div style={{ padding: 18 }}>
              <div onClick={() => setStep('trips')} style={{ fontSize: 13, color: T.teal, fontWeight: 600, cursor: 'pointer', marginBottom: 14 }}>← {trip?.name}</div>
              <div style={{ fontSize: 13, color: T.muted, marginBottom: 10 }}>Choose a date</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 22 }}>
                {slots.map((s) => {
                  const sel = slotId === s.id
                  return (
                    <div
                      key={s.id}
                      onClick={() => setSlotId(s.id)}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', borderRadius: 12, padding: '13px 16px', border: `1.5px solid ${sel ? T.teal : T.cardBorder}`, background: sel ? T.riskOkBg : T.white }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14.5 }}>{s.label}</div>
                        <div style={{ fontSize: 12, color: T.muted }}>{s.time}</div>
                      </div>
                      {sel && <Icon name="check" size={18} color={T.teal} />}
                    </div>
                  )
                })}
              </div>
              <div style={{ fontSize: 13, color: T.muted, marginBottom: 10 }}>Party size</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                <button onClick={() => setParty((p) => Math.max(1, p - 1))} style={{ width: 42, height: 42, borderRadius: 11, border: `1px solid #d8d2c4`, background: T.white, cursor: 'pointer', color: T.ink, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="minus" size={18} />
                </button>
                <span style={{ fontFamily: serif, fontSize: 24, fontWeight: 700, minWidth: 30, textAlign: 'center' }}>{party}</span>
                <button onClick={() => setParty((p) => Math.min(maxParty, p + 1))} style={{ width: 42, height: 42, borderRadius: 11, border: `1px solid #d8d2c4`, background: T.white, cursor: 'pointer', color: T.ink, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="plus" size={18} />
                </button>
                <span style={{ fontSize: 12.5, color: T.muted2 }}>max {maxParty} anglers</span>
              </div>
            </div>
          )}

          {/* STEP 3 — pay */}
          {step === 'pay' && (
            <div style={{ padding: 18 }}>
              <div onClick={() => setStep('date')} style={{ fontSize: 13, color: T.teal, fontWeight: 600, cursor: 'pointer', marginBottom: 14 }}>← Back</div>
              <div style={{ background: T.white, border: `1px solid ${T.cardBorder}`, borderRadius: 14, padding: 16, marginBottom: 18 }}>
                <div style={{ fontWeight: 700, fontSize: 16, fontFamily: serif, marginBottom: 10 }}>{trip?.name}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: T.body2, padding: '4px 0' }}><span>{slot?.label}</span><span>{party} anglers</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: T.body2, padding: '4px 0 10px', borderBottom: `1px solid ${T.hairline}` }}><span>Trip total (incl. GST)</span><span>{money(trip?.price)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700, paddingTop: 10 }}><span>Deposit due now</span><span style={{ color: T.teal }}>{money(trip?.deposit)}</span></div>
                <div style={{ fontSize: 11.5, color: T.muted2, marginTop: 4 }}>Balance paid to the captain at the marina.</div>
              </div>

              <div style={{ fontSize: 13, color: T.muted, marginBottom: 8 }}>Your details</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 14 }}>
                <input style={field} placeholder="Full name" value={cust.name} onChange={(e) => setCust((c) => ({ ...c, name: e.target.value }))} />
                <div style={{ display: 'flex', gap: 9 }}>
                  <input style={field} placeholder="Email" value={cust.email} onChange={(e) => setCust((c) => ({ ...c, email: e.target.value }))} />
                  <input style={field} placeholder="Mobile" value={cust.phone} onChange={(e) => setCust((c) => ({ ...c, phone: e.target.value }))} />
                </div>
              </div>

              <div style={{ fontSize: 13, color: T.muted, marginBottom: 8 }}>Card details</div>
              <div style={{ background: T.white, border: `1px solid ${T.cardBorder}`, borderRadius: 11, padding: '13px 15px', fontSize: 14, color: T.muted2, marginBottom: 9, letterSpacing: '0.04em' }}>1234  5678  9012  3456</div>
              <div style={{ display: 'flex', gap: 9, marginBottom: 8 }}>
                <div style={{ flex: 1, background: T.white, border: `1px solid ${T.cardBorder}`, borderRadius: 11, padding: '13px 15px', fontSize: 14, color: T.muted2 }}>06 / 28</div>
                <div style={{ flex: 1, background: T.white, border: `1px solid ${T.cardBorder}`, borderRadius: 11, padding: '13px 15px', fontSize: 14, color: T.muted2 }}>CVC</div>
              </div>
              <div style={{ fontSize: 11, color: T.muted2, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="shield" size={13} color={T.teal} /> Secured by Stripe — card fields are Stripe Elements in production.
              </div>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 12.5, color: T.body2, lineHeight: 1.5, cursor: 'pointer' }}>
                <span
                  onClick={() => setWaiver((w) => !w)}
                  style={{ width: 18, height: 18, borderRadius: 5, background: waiver ? T.teal : T.white, border: `1px solid ${waiver ? T.teal : T.cardBorder}`, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}
                >
                  {waiver && <Icon name="check" size={12} />}
                </span>
                <span>I agree to the <span style={{ color: T.teal, fontWeight: 600 }}>liability waiver</span> &amp; cancellation policy.</span>
              </label>
            </div>
          )}

          {/* STEP 4 — done */}
          {step === 'done' && (
            <div style={{ padding: '30px 22px', textAlign: 'center' }}>
              <div style={{ width: 68, height: 68, borderRadius: '50%', background: T.teal, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                <Icon name="check" size={34} />
              </div>
              <h2 style={{ fontFamily: serif, fontSize: 24, fontWeight: 700, marginBottom: 6 }}>You're booked!</h2>
              <p style={{ fontSize: 13.5, color: T.muted, lineHeight: 1.55, marginBottom: 22 }}>Deposit paid &amp; waiver signed. {captain.name} will text the marina pin the night before.</p>
              <div style={{ background: T.white, border: `1px solid ${T.cardBorder}`, borderRadius: 14, padding: 18, textAlign: 'left', marginBottom: 18 }}>
                <div style={{ fontWeight: 700, fontSize: 15, fontFamily: serif }}>{trip?.name}</div>
                <div style={{ fontSize: 13, color: T.body2, marginTop: 4 }}>{slot?.label} · party of {party}</div>
                <div style={{ fontSize: 13, color: T.teal, fontWeight: 600, marginTop: 8 }}>{money(trip?.deposit)} deposit paid · {money((trip?.price || 0) - (trip?.deposit || 0))} due at marina</div>
              </div>
              <div style={{ background: T.riskOkBg, borderRadius: 14, padding: '16px 18px', textAlign: 'left' }}>
                <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.teal, fontWeight: 700, marginBottom: 8 }}>What to bring</div>
                <div style={{ fontSize: 13, color: T.body, lineHeight: 1.7 }}>{trip?.whatToBring}</div>
              </div>
              <button onClick={reset} style={{ marginTop: 22, background: 'none', border: 'none', color: T.teal, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: sans, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Icon name="refresh" size={14} /> Book another trip
              </button>
            </div>
          )}
        </div>

        {cta && (
          <div style={{ padding: '14px 18px 18px', background: T.phoneSand, borderTop: `1px solid #ece7db` }}>
            <button
              onClick={cta.action}
              disabled={cta.disabled}
              style={{ width: '100%', background: cta.disabled ? '#e8b5aa' : T.coral, color: '#fff', border: 'none', borderRadius: 13, padding: 15, fontSize: 15, fontWeight: 700, fontFamily: sans, cursor: cta.disabled ? 'default' : 'pointer' }}
            >
              {cta.label}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
