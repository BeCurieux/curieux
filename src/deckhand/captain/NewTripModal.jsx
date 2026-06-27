import { useState } from 'react'
import { useStore } from '../store.jsx'
import { T, serif, sans, money } from '../theme.js'
import Icon from '../icons.jsx'
import { Button } from '../ui.jsx'

const field = {
  width: '100%', padding: '11px 13px', fontSize: 14, border: `1px solid ${T.cardBorder}`,
  borderRadius: 9, fontFamily: sans, color: T.ink, background: T.white, outline: 'none',
}
const lbl = { fontSize: 12.5, color: T.muted, fontFamily: sans, marginBottom: 6, display: 'block', fontWeight: 600 }

// Create a new trip type for the booking page (README §6 TripType).
export default function NewTripModal({ onClose }) {
  const { addTripType } = useStore()
  const [f, setF] = useState({ name: '', price: '', deposit: '', durationLabel: '', capacity: '8', desc: '' })
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))
  const valid = f.name && f.price && f.deposit

  const save = () => {
    addTripType({
      name: f.name,
      price: Number(f.price),
      deposit: Number(f.deposit),
      durationLabel: f.durationLabel || '—',
      durationHrs: parseFloat(f.durationLabel) || 0,
      capacity: Number(f.capacity) || 8,
      desc: f.desc,
    })
    onClose()
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(20,32,46,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: T.white, borderRadius: 16, padding: 26, width: 440, maxWidth: '100%', boxShadow: '0 30px 60px -20px rgba(20,32,46,0.55)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h2 style={{ fontFamily: serif, fontSize: 22, fontWeight: 600, color: T.ink }}>New trip type</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted }}>
            <Icon name="x" size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={lbl}>Trip name</label>
            <input style={field} value={f.name} onChange={set('name')} placeholder="e.g. Twilight Snapper Run" />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Price (incl. GST)</label>
              <input style={field} value={f.price} onChange={set('price')} type="number" placeholder="1100" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Deposit</label>
              <input style={field} value={f.deposit} onChange={set('deposit')} type="number" placeholder="300" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Duration</label>
              <input style={field} value={f.durationLabel} onChange={set('durationLabel')} placeholder="5 hrs" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Max anglers</label>
              <input style={field} value={f.capacity} onChange={set('capacity')} type="number" />
            </div>
          </div>
          <div>
            <label style={lbl}>Description</label>
            <textarea style={{ ...field, minHeight: 70, resize: 'vertical' }} value={f.desc} onChange={set('desc')} placeholder="What the trip is about…" />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="teal" disabled={!valid} onClick={save}>
            Add trip {f.price ? `· ${money(f.price)}` : ''}
          </Button>
        </div>
      </div>
    </div>
  )
}
