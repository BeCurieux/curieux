// DeckHand design tokens — mirrors README §8. Single source of truth for the
// look the prototype defines (colour, type, shape).

export const T = {
  // Core
  ink: '#14202e', // top bar, primary text, dark buttons
  sidebar: '#1b2a3a', // dashboard sidebar
  coral: '#e0533d', // primary action, active toggle, alert accents
  teal: '#2f6f6b', // success, prices, links, valid status
  tealText: '#7fb0ac', // muted text on navy
  // Surfaces
  pageSand: '#f3f1ec', // dashboard background
  phoneSand: '#f6f5f1', // phone / mobile background
  cream: '#f4efe6', // text on navy
  white: '#ffffff',
  cardBorder: '#e3ddcf', // card outlines
  hairline: '#f0ece2', // row separators
  // Text
  body: '#3a4350',
  body2: '#5a6470',
  muted: '#6b7468',
  muted2: '#9aa39c',
  // Amber (watch / expiring)
  amber: '#b97d23',
  amberBg: '#fbeede',
  amberDot: '#d9912f',
  amberBorder: '#f0dcb8',
  // Risk scale
  riskOk: '#2f6f6b',
  riskOkBg: '#eef3f1',
  riskOkBorder: '#dfeae6',
  riskWatch: '#b97d23',
  riskWatchBg: '#fbeede',
  riskWatchBorder: '#f0dcb8',
  riskHigh: '#e0533d',
  riskHighBg: '#fdede9',
  riskHighBorder: '#f5cabd',
  // Status pills
  confirmedBg: '#e7f1ee',
  confirmedText: '#2f6f6b',
  rebookingBg: '#fbe6df',
  rebookingText: '#e0533d',
  openBg: '#f0ece2',
  openText: '#9aa39c',
  // Risk dots
  dotOpen: '#cfd6cf',
  // Borders for weather card states
  warnBorder: '#f1c9bd',
  okBorder: '#bcd8d0',
}

export const RISK = {
  ok: { color: T.riskOk, bg: T.riskOkBg, border: T.riskOkBorder, label: 'Good' },
  watch: { color: T.riskWatch, bg: T.riskWatchBg, border: T.riskWatchBorder, label: 'Watch' },
  high: { color: T.riskHigh, bg: T.riskHighBg, border: T.riskHighBorder, label: 'High risk' },
}

export const serif = "'Spectral', Georgia, serif"
export const sans = "'Archivo', system-ui, sans-serif"

export const money = (n) =>
  '$' + Number(n || 0).toLocaleString('en-AU', { maximumFractionDigits: 0 })

// Reusable inline-style fragments
export const card = {
  background: T.white,
  border: `1px solid ${T.cardBorder}`,
  borderRadius: 12,
}

export const pill = (bg, color) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
  fontSize: 12.5,
  fontWeight: 600,
  padding: '4px 11px',
  borderRadius: 20,
  background: bg,
  color,
  whiteSpace: 'nowrap',
  fontFamily: sans,
})
