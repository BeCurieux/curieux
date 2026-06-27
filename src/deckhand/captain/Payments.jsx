import { useStore } from '../store.jsx'
import { T, serif, money, card } from '../theme.js'
import Icon from '../icons.jsx'
import { H1, StatusPill } from '../ui.jsx'

const gst = (inclPrice) => Math.round(inclPrice / 11) // AU GST = 1/11 of GST-incl

function Summary({ label, value, color = T.ink }) {
  return (
    <div style={{ ...card, padding: '16px 18px' }}>
      <div style={{ fontSize: 12, color: T.muted, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: serif, fontSize: 26, fontWeight: 700, color }}>{value}</div>
    </div>
  )
}

export default function Payments() {
  const { bookings } = useStore()
  const paid = bookings.filter((b) => b.status !== 'open')
  const depositsTotal = paid.reduce((s, b) => s + b.deposit, 0)
  const balanceTotal = paid.reduce((s, b) => s + (b.price - b.deposit), 0)
  const gstTotal = paid.reduce((s, b) => s + gst(b.price), 0)

  return (
    <div>
      <H1>Payments</H1>
      <div style={{ fontSize: 13, color: T.muted, margin: '2px 0 22px' }}>Deposits via Stripe · balances taken at the marina</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 22 }}>
        <Summary label="Deposits collected (Stripe)" value={money(depositsTotal)} color={T.teal} />
        <Summary label="Balance due at marina" value={money(balanceTotal)} />
        <Summary label="GST collected" value={money(gstTotal)} />
      </div>

      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr 110px', gap: 12, padding: '12px 20px', borderBottom: `1px solid ${T.hairline}`, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: T.muted2, fontWeight: 700 }}>
          <div>Guest / trip</div>
          <div>Trip total</div>
          <div>Deposit paid</div>
          <div>Balance</div>
          <div style={{ textAlign: 'right' }}>Status</div>
        </div>
        {paid.map((b) => (
          <div key={b.id} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr 110px', gap: 12, padding: '14px 20px', borderBottom: `1px solid ${T.hairline}`, alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{b.guest}</div>
              <div style={{ fontSize: 12, color: T.muted }}>{b.tripName} · incl. {money(gst(b.price))} GST</div>
            </div>
            <div style={{ fontSize: 14, color: T.body }}>{money(b.price)}</div>
            <div style={{ fontSize: 14, color: T.teal, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="check" size={14} color={T.teal} />{money(b.deposit)}
            </div>
            <div style={{ fontSize: 14, color: T.body }}>{money(b.price - b.deposit)}</div>
            <div style={{ textAlign: 'right' }}><StatusPill status={b.status} /></div>
          </div>
        ))}
      </div>
    </div>
  )
}
