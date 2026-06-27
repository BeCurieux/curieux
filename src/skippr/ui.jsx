// Small shared primitives for the Skippr UI.
import { T, serif, sans } from './theme.js'

export function Avatar({ initials, size = 38, fontSize = 15 }) {
  return (
    <span
      style={{
        width: size, height: size, borderRadius: '50%', background: T.teal, color: T.cream,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize, flexShrink: 0,
      }}
    >
      {initials}
    </span>
  )
}

const STATUS = {
  confirmed: { bg: T.confirmedBg, color: T.confirmedText, label: 'Confirmed' },
  rebooking: { bg: T.rebookingBg, color: T.rebookingText, label: 'Rebooking' },
  open: { bg: T.openBg, color: T.openText, label: 'Open' },
  completed: { bg: T.confirmedBg, color: T.confirmedText, label: 'Completed' },
  cancelled: { bg: T.rebookingBg, color: T.rebookingText, label: 'Cancelled' },
}

export function StatusPill({ status }) {
  const s = STATUS[status] || STATUS.open
  return (
    <span
      style={{
        fontSize: 11.5, fontWeight: 600, padding: '4px 11px', borderRadius: 20,
        background: s.bg, color: s.color, whiteSpace: 'nowrap', fontFamily: sans,
      }}
    >
      {s.label}
    </span>
  )
}

export function RiskDot({ color, size = 7 }) {
  return (
    <span style={{ width: size, height: size, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />
  )
}

export function Button({ children, onClick, variant = 'primary', disabled, style }) {
  const base = {
    border: 'none', borderRadius: 9, fontFamily: sans, fontWeight: 600, cursor: disabled ? 'default' : 'pointer',
    padding: '11px 18px', fontSize: 13.5, transition: 'opacity .15s',
  }
  const variants = {
    primary: { background: T.ink, color: T.cream },
    coral: { background: T.coral, color: '#fff' },
    teal: { background: T.teal, color: '#fff' },
    ghost: { background: 'transparent', color: T.teal, padding: '8px 0' },
    outline: { background: T.white, color: T.ink, border: `1px solid ${T.cardBorder}` },
  }
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{ ...base, ...variants[variant], ...(disabled ? { opacity: 0.5 } : null), ...style }}
    >
      {children}
    </button>
  )
}

export function H1({ children }) {
  return <h1 style={{ fontFamily: serif, fontSize: 30, fontWeight: 600, color: T.ink }}>{children}</h1>
}

export function SectionLabel({ children, style }) {
  return (
    <div
      style={{
        fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.muted,
        fontWeight: 700, fontFamily: sans, ...style,
      }}
    >
      {children}
    </div>
  )
}
