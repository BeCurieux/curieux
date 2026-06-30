// Inline SVG icons ported from the Lattice prototype. Stroke uses currentColor
// so nav glyphs inherit the active/inactive colour. Swap for an icon set
// (Polaris Icons, Lucide) in production.

const s = (p) => ({ width: 17, height: 17, viewBox: '0 0 18 18', fill: 'none', ...p })

export const IconHome = () => (
  <svg {...s()}><path d="M3 8 9 3l6 5v6.5a1 1 0 0 1-1 1h-3v-4H7v4H4a1 1 0 0 1-1-1z" stroke="currentColor" strokeWidth="1.4" /></svg>
)
export const IconBundles = () => (
  <svg {...s()}><path d="M9 1.8 16 5.4v7.2L9 16.2 2 12.6V5.4z" stroke="currentColor" strokeWidth="1.5" /><path d="M2 5.4 9 9l7-3.6M9 9v7.2" stroke="currentColor" strokeWidth="1.5" opacity=".5" /></svg>
)
export const IconFeeds = () => (
  <svg {...s()}><path d="M2.5 7v4l9 4V3zM11.5 5.5 15 4v10l-3.5-1.5" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>
)
export const IconSubs = () => (
  <svg {...s()}><path d="M15 6a6 6 0 1 0 .4 4" stroke="currentColor" strokeWidth="1.4" /><path d="M15 2.5V6h-3.5" stroke="currentColor" strokeWidth="1.4" /></svg>
)
export const IconInventory = () => (
  <svg {...s()}><path d="M2.5 7 9 3.5 15.5 7v7.5h-13z" stroke="currentColor" strokeWidth="1.4" /><path d="M6.5 14.5v-4h5v4" stroke="currentColor" strokeWidth="1.4" /></svg>
)
export const IconPerformance = () => (
  <svg {...s()}><path d="M9 16a7 7 0 1 1 7-7" stroke="currentColor" strokeWidth="1.4" /><path d="M9 9l3.5-2.5" stroke="currentColor" strokeWidth="1.5" /></svg>
)
export const IconAnalytics = () => (
  <svg {...s()}><path d="M3 15V8M8 15V4M13 15v-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
)

export const IconWarehouse = ({ color = '#d4643c' }) => (
  <svg width="19" height="19" viewBox="0 0 18 18" fill="none"><path d="M2.5 7 9 3.5 15.5 7v7.5h-13z" stroke={color} strokeWidth="1.4" /><path d="M6.5 14.5v-4h5v4" stroke={color} strokeWidth="1.4" /></svg>
)

export const IconWarning = ({ color = '#c2410c', size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ flex: 'none' }}><path d="M8 1.5 15 14H1z" stroke={color} strokeWidth="1.3" strokeLinejoin="round" /><path d="M8 6v4M8 11.5v.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" /></svg>
)

export const IconCheck = ({ color = '#fff', size = 18, w = 1.8 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16"><path d="M4 8l2.5 2.5L12 5" stroke={color} strokeWidth={w} fill="none" /></svg>
)

export const IconCheckSmall = ({ color = '#3f7d57' }) => (
  <svg width="12" height="12" viewBox="0 0 14 14"><path d="M3 7l2.5 2.5L11 4" stroke={color} strokeWidth="1.6" fill="none" /></svg>
)

export const IconWarnTri = ({ color = '#fff', size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none"><path d="M8 2 15 14H1z" stroke={color} strokeWidth="1.4" strokeLinejoin="round" /><path d="M8 6.5v3.5M8 11.5v.4" stroke={color} strokeWidth="1.5" strokeLinecap="round" /></svg>
)

export const IconShield = ({ color = '#9fd4b4' }) => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flex: 'none', marginTop: 1 }}><path d="M7 1 12 3.2v3.4c0 3-2.1 5.2-5 6.4-2.9-1.2-5-3.4-5-6.4V3.2z" stroke={color} strokeWidth="1.2" /></svg>
)

export const IconSearch = ({ color = '#a59a8d' }) => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4.2" stroke={color} strokeWidth="1.3" /><path d="M9.2 9.2 12 12" stroke={color} strokeWidth="1.3" /></svg>
)

export const IconBell = ({ color = '#8a7d6e' }) => (
  <svg width="19" height="19" viewBox="0 0 20 20" fill="none"><path d="M10 2.5a4.5 4.5 0 0 0-4.5 4.5c0 4-1.5 5-1.5 5h12s-1.5-1-1.5-5A4.5 4.5 0 0 0 10 2.5zM8 17a2 2 0 0 0 4 0" stroke={color} strokeWidth="1.3" /></svg>
)

export const IconChevron = ({ color = '#5b5249' }) => (
  <svg width="11" height="11" viewBox="0 0 12 12" style={{ opacity: 0.5 }}><path d="M3 5l3 3 3-3" stroke={color} strokeWidth="1.3" fill="none" /></svg>
)

export const IconCube = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1.5 14 5v6L8 14.5 2 11V5z" stroke="#fff" strokeWidth="1.3" /><path d="M2 5l6 3.5L14 5" stroke="#fff" strokeWidth="1.3" opacity=".6" /></svg>
)
