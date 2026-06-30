// Shared design tokens + inline-style builders for Lattice.
//
// The palette is faithful to the Lattice prototype's warm terracotta-on-cream
// brand, with a few RESTRAINED softening touches per the product direction
// ("like the mock, a touch more feminine — not too much"):
//   - a dusty-rose SECONDARY accent (T.rose) used sparingly for decorative
//     detail (logo gradient, avatar, active-nav rail, a couple of dots),
//   - very subtle blush warmth in the page + app-card backgrounds,
//   - a soft rounded accent rail on the active sidebar item.
// Layout, structure, copy, and the core terracotta/green/warning system are
// unchanged from the spec.

export const T = {
  // surfaces
  page: '#ece4dc', // page behind the app card (prototype #e9e3d8, warmed a hair)
  appBg: '#f4efe7', // app card / panel
  raised: '#fffdf9', // raised cards
  inset: '#faf6f0', // inset tiles
  border: '#ece3d6',
  divider: '#f0e8db',
  divider2: '#f4eee4',
  tileBorder: '#efe6d9',
  tileBorder2: '#e2d9c9',

  // brand accent (terracotta)
  accent: '#d4643c',
  accentDeep: '#b5491f',
  accentTint: '#fbeee6',
  accentTint2: '#fdf6f1',
  accentBorder: '#f0d4c4',
  dash: '#e0c8b6',

  // secondary accent (dusty rose) — the feminine touch
  rose: '#c87a8e',
  roseSoft: '#d99aa8',
  roseTint: '#f6e7ea',

  // text
  ink: '#2a2420',
  body: '#5b5249',
  muted: '#6f655c',
  muted2: '#8a7d6e',
  faint: '#a59a8d',
  label: '#bcae9c',

  // success green
  green: '#3f7d57',
  greenDeep: '#2f7350',
  greenDeeper: '#23503a',
  greenSoft: '#4e7d63',
  greenTint: '#e7f1ea',
  greenBorder: '#cfe3d6',
  greenOnDark: '#9fd4b4',

  // warning / error
  warn: '#c2410c',
  warnText: '#9a4a1e',
  warnText2: '#b07a55',
  warnTint: '#fdf0e9',
  warnTint2: '#fdf3ee',
  warnBorder: '#f4d8c8',
  amber: '#c9a227',

  // dark panel
  dark: '#2a2420',
  darkBody: '#cabfb2',

  // channel brand glyphs
  meta: '#1877f2',
  google: '#4285f4',
  pinterest: '#e60023',

  // type
  display: "'Bricolage Grotesque', system-ui, sans-serif",
  mono: 'ui-monospace, monospace',
}

// Monogram tile palettes: name -> [bg, fg]
export const MONO = {
  sage: ['#dfe8d9', '#5f7a52'],
  lilac: ['#e3ddef', '#6b5fa0'],
  clay: ['#f1ddd2', '#b5713f'],
  teal: ['#d9e6e8', '#4d8088'],
  sand: ['#ece2cf', '#a07f4e'],
  rose: ['#f1dde1', '#b06b7d'],
}

export const SHADOW_APP = '0 26px 64px -26px rgba(42,36,32,.4), 0 4px 16px rgba(42,36,32,.08)'
export const SHADOW_HOVER = '0 8px 22px -10px rgba(42,36,32,.18)'

// ---- reusable style objects ----

export const card = {
  background: T.raised, border: `1px solid ${T.border}`, borderRadius: '15px',
  padding: '18px', transition: 'box-shadow .2s',
}

export const panel = {
  background: T.raised, border: `1px solid ${T.border}`, borderRadius: '16px', overflow: 'hidden',
}

export const screenTitle = {
  fontFamily: T.display, fontWeight: 700, fontSize: '27px', color: T.ink, margin: 0, letterSpacing: '-.02em',
}
export const screenSub = { fontSize: '13.5px', color: T.muted2, marginTop: '7px' }
export const cardHeading = { fontFamily: T.display, fontWeight: 600, fontSize: '15px', color: T.ink }

// buttons
export const primaryBtn = {
  fontFamily: 'inherit', fontSize: '13.5px', fontWeight: 700, color: '#fff', background: T.accent,
  border: 'none', padding: '11px 18px', borderRadius: '11px', cursor: 'pointer', whiteSpace: 'nowrap',
}
export const ghostBtn = {
  fontFamily: 'inherit', fontSize: '13.5px', fontWeight: 700, color: T.ink, background: '#fff',
  border: `1px solid ${T.tileBorder2}`, padding: '11px 18px', borderRadius: '11px', cursor: 'pointer', whiteSpace: 'nowrap',
}

// sidebar nav item (with a soft rose rail on the active item)
export const navItem = (active) => ({
  position: 'relative', display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px',
  borderRadius: '11px', fontSize: '13.5px', marginBottom: '3px', cursor: 'pointer', transition: 'background .15s',
  background: active ? T.accentTint : 'transparent',
  color: active ? T.accentDeep : T.muted,
  fontWeight: active ? 700 : 600,
})
export const navRail = (active) => ({
  position: 'absolute', left: '-2px', top: '9px', bottom: '9px', width: '3px', borderRadius: '3px',
  background: active ? T.rose : 'transparent', transition: 'background .15s',
})

// filter / tab chips
export const chip = (active) => ({
  fontSize: '12.5px', fontWeight: active ? 700 : 600, padding: '8px 14px', borderRadius: '9px', cursor: 'pointer',
  border: `1px solid ${active ? T.accentBorder : T.border}`,
  background: active ? T.accentTint : '#fff',
  color: active ? T.accentDeep : T.muted,
})

// toggle switch (terracotta track)
export const switchTrack = (on) => ({
  width: '34px', height: '19px', borderRadius: '20px', position: 'relative', display: 'inline-block',
  background: on ? T.accent : '#d8cdbd', cursor: 'pointer', transition: 'background .15s', flexShrink: 0,
})
export const switchKnob = (on) => ({
  position: 'absolute', top: '2.5px', left: on ? '17.5px' : '2.5px', width: '14px', height: '14px',
  borderRadius: '50%', background: '#fff', transition: 'left .15s', boxShadow: '0 1px 2px rgba(0,0,0,.2)',
})

// quantity stepper button
export const stepBtn = {
  width: '26px', height: '26px', border: 'none', background: T.appBg, borderRadius: '7px',
  color: T.muted2, fontSize: '16px', cursor: 'pointer', lineHeight: 1,
}

// monogram tile
export const mono = (name, size = 42, radius = 10, fontSize = 12) => {
  const [bg, fg] = MONO[name] || MONO.sand
  return {
    width: size, height: size, borderRadius: radius, background: bg, color: fg, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize,
  }
}

// status pill (green "Published" / "Active" / "Valid" style)
export const pill = (kind) => {
  const map = {
    ok: { bg: T.greenTint, c: T.green },
    warn: { bg: T.warnTint, c: T.warn },
    accent: { bg: T.accentTint, c: T.accentDeep },
  }
  const m = map[kind] || map.ok
  return {
    display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: 700,
    color: m.c, background: m.bg, padding: '4px 12px', borderRadius: '20px',
  }
}
