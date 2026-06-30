// Static sample data for the fictional merchant "Northbound Supply Co."
// In production these come from Shopify Admin GraphQL (products, variants,
// inventory levels, selling plans) + your own feed/analytics services.
// Numbers are realistic mock data taken from the Lattice prototype.

export const STORE = {
  id: 'northbound',
  name: 'Northbound Supply Co.',
  domain: 'northbound-supply.myshopify.com',
  swatch: '#3f7d57',
  user: { name: 'Avery Morgan', initials: 'AM' },
}

// Warehouses the merchant fulfills from.
export const WAREHOUSES = [
  { id: 'all', name: 'All warehouses' },
  { id: 'la', name: 'Los Angeles' },
  { id: 'ny', name: 'New York' },
]

// Components (products) that make up bundles. Stock is per-warehouse so the
// engine can derive weakest-link availability.
export const COMPONENTS = [
  {
    id: 'shirt', code: 'LC', name: 'Linen Camp Shirt', sku: 'NB-LCS-SAGE-M', tile: 'sage',
    stock: { la: 96, ny: 32 }, size: 'M', qty: 1,
    swatches: [
      { color: '#9caf88', name: 'sage', selected: true },
      { color: '#c9bfa8', name: 'oat' },
      { color: '#7e8a9c', name: 'slate' },
    ],
  },
  {
    id: 'chino', code: 'PC', name: 'Pleated Chino Short', sku: 'NB-PCS-STONE-32', tile: 'sand',
    stock: { la: 40, ny: 24 }, size: '32', qty: 1,
    swatches: [
      { color: '#c9bfa8', name: 'stone', selected: true },
      { color: '#3a4150', name: 'navy' },
    ],
  },
  {
    id: 'tote', code: 'CT', name: 'Canvas Field Tote', sku: 'NB-CFT-NAT-OS', tile: 'sage',
    stock: { la: 12, ny: 0 }, size: 'OS', qty: 1, lowAt: 14,
    swatches: [{ color: '#cdbfa6', name: 'natural', selected: true }],
  },
]

// Bundles. `components` references COMPONENTS by id (Summer Essentials is the
// hero pack shown in the builder); the rest are summarized for list views.
export const BUNDLES = [
  {
    id: 'summer', code: 'SE', name: 'Summer Essentials 3-Pack', tile: 'sage',
    itemCount: 3, components: ['shirt', 'chino', 'tote'],
    type: 'subscription', listPrice: 142, price: 120, saving: 22, subPrice: 108,
    attach: 31, status: 'NY paused', statusKind: 'warn', published: true,
  },
  {
    id: 'nightly', code: 'NR', name: 'Nightly Reset Duo', tile: 'lilac',
    itemCount: 2, type: 'subscription', price: 54,
    attach: 44, status: 'All in stock', statusKind: 'ok', published: true,
  },
  {
    id: 'trailhead', code: 'TK', name: 'Trailhead Kit', tile: 'clay',
    itemCount: 4, type: 'one-time', price: 186,
    attach: 22, status: 'All in stock', statusKind: 'ok', published: true,
  },
  {
    id: 'coastal', code: 'CB', name: 'Coastal Breeze Box', tile: 'teal',
    itemCount: 5, type: 'subscription', price: 98,
    attach: 28, status: 'All in stock', statusKind: 'ok', published: true,
  },
]

// Home dashboard KPIs.
export const HOME_KPIS = [
  { label: 'Bundle revenue · 30d', value: '$48,210', delta: '▲ 14% vs prior', deltaKind: 'good' },
  { label: 'Active subscriptions', value: '612', delta: '▲ 38 this month', deltaKind: 'good' },
  { label: 'Feed health', value: '100%', delta: '3 / 3 channels valid', deltaKind: 'muted' },
  { label: 'Avg Lighthouse', value: '99', delta: '0 ms layout shift', deltaKind: 'muted', valueColor: '#2f7350' },
]

export const HOME_ATTENTION = [
  { dot: 'warn', strong: '1 component out of stock', rest: ' in New York — 1 bundle auto-hidden East-Coast.' },
  { dot: 'amber', strong: '2 subscriptions paused', rest: ' this week — dunning email sent.' },
  { dot: 'good', strong: 'Google feed re-validated', rest: ' 2h ago — all 47 variants pass.' },
]

// Selling plans + cadence options (bundle builder + subscriptions screen).
export const CADENCES = [
  { id: 'monthly', label: 'Monthly', selected: true },
  { id: 'bimonthly', label: 'Every 2 mo' },
]

// Ad-feed channels.
export const CHANNELS = [
  { id: 'meta', name: 'Meta Shopping', glyph: 'f', color: '#1877f2', glyphColor: '#fff', synced: 47, total: 47, errors: 0, lastSync: '8 min ago', valid: true },
  { id: 'google', name: 'Google Merchant', glyph: 'G', color: '#fff', glyphColor: '#4285f4', bordered: true, synced: 47, total: 47, errors: 0, lastSync: '2 h ago', valid: true },
  { id: 'pinterest', name: 'Pinterest', glyph: 'P', color: '#e60023', glyphColor: '#fff', synced: 47, total: 47, errors: 0, lastSync: '8 min ago', valid: true },
]

// Feed schema mapping (Summer Essentials → parent feed item).
export const FEED_SCHEMA = [
  { field: 'id', value: 'latt_8fa20c', source: 'parent', sourceKind: 'good' },
  { field: 'item_group_id', value: 'summer-essentials', source: 'parent', sourceKind: 'good' },
  { field: 'price', value: '120.00 USD', source: 'function', sourceKind: 'good' },
  { field: 'bundle', value: 'yes · 3 components', source: 'auto', sourceKind: 'accent', highlight: true },
  { field: 'availability', value: 'in_stock · region-gated', source: 'inventory', sourceKind: 'good' },
]

export const SYNC_LOG = [
  { dot: 'good', title: 'Meta + Pinterest pushed', meta: '8 min ago · 47 items · 0 errors' },
  { dot: 'good', title: 'Google re-validated', meta: '2 h ago · all variants pass' },
  { dot: 'amber', title: 'Tote → out_of_stock (NY)', meta: '3 h ago · region availability updated' },
]

// Subscriptions screen.
export const SUBS_KPIS = [
  { label: 'Subscription MRR', value: '$22,860', delta: '▲ 9% MoM', deltaKind: 'good' },
  { label: 'Active', value: '612', delta: 'across 3 plans', deltaKind: 'muted' },
  { label: 'Paused', value: '14', delta: '2 new this week', deltaKind: 'muted', valueColor: '#c2410c' },
  { label: 'Churn · 30d', value: '3.1%', delta: '▼ 0.6pt', deltaKind: 'good' },
]

export const RENEWALS = [
  { code: 'SE', tile: 'sage', name: 'Summer Essentials 3-Pack', cadence: 'Monthly', subs: 41, date: 'Jul 2', amount: '$4,428' },
  { code: 'NR', tile: 'lilac', name: 'Nightly Reset Duo', cadence: 'Monthly', subs: 28, date: 'Jul 4', amount: '$1,512' },
  { code: 'CB', tile: 'teal', name: 'Coastal Breeze Box', cadence: 'Every 2 mo', subs: 17, date: 'Jul 6', amount: '$1,666' },
]

export const SELLING_PLANS = [
  { id: 'save10', name: 'Subscribe & save 10%', cadence: 'Monthly', bundles: 3, subs: 583, active: true, primary: true },
  { id: 'save15', name: 'Save 15% · every 2 mo', cadence: 'Bi-monthly', bundles: 1, subs: 29, active: true },
]

// Performance screen.
export const PERF_SCORE = 99
export const PERF_METRICS = [
  { label: 'CUMULATIVE LAYOUT SHIFT', value: '0.00', note: 'No flicker — priced via Functions', valueColor: '#2f7350' },
  { label: 'LARGEST CONTENTFUL PAINT', value: '1.2', unit: 's', note: 'Widget loads after paint' },
  { label: 'WIDGET BUNDLE SIZE', value: '11', unit: 'kb', note: 'gzipped · zero dependencies' },
  { label: 'BLOCKING RESOURCES', value: '0', note: 'async + deferred injection', valueColor: '#2f7350' },
]
export const PERF_COMPARISON = [
  { label: 'Lattice widget', size: '11 kb', width: 14, color: '#3f7d57', strong: true, sizeColor: '#2f7350' },
  { label: 'Legacy app A', size: '214 kb', width: 72, color: '#cdb89e', sizeColor: '#8a7d6e' },
  { label: 'Legacy app B (React)', size: '390 kb', width: 100, color: '#c2410c', sizeColor: '#c2410c' },
]

// Analytics screen.
export const ANALYTICS_KPIS = [
  { label: 'Bundle revenue', value: '$48,210', delta: '▲ 14%', deltaKind: 'good' },
  { label: 'Attach rate', value: '29%', delta: '▲ 4pt', deltaKind: 'good' },
  { label: 'AOV uplift', value: '+19%', delta: 'vs single items', deltaKind: 'muted' },
  { label: 'Repeat rate', value: '2.4×', delta: 'when subscribed', deltaKind: 'muted' },
]
// Weekly stacked bars (one-time over subscription). Heights in px (170px plot).
export const REVENUE_BY_WEEK = [
  { week: 'W1', oneTime: 54, subscription: 46 },
  { week: 'W2', oneTime: 62, subscription: 58 },
  { week: 'W3', oneTime: 70, subscription: 66 },
  { week: 'W4', oneTime: 82, subscription: 78 },
]
export const TOP_BUNDLES = [
  { rank: 1, name: 'Summer Essentials 3-Pack', attach: '31% attach', revenue: '$18.4k' },
  { rank: 2, name: 'Nightly Reset Duo', attach: '44% attach', revenue: '$12.1k' },
  { rank: 3, name: 'Coastal Breeze Box', attach: '28% attach', revenue: '$9.7k' },
  { rank: 4, name: 'Trailhead Kit', attach: '22% attach', revenue: '$8.0k' },
]
