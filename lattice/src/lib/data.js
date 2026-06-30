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
<<<<<<< Updated upstream
// engine can derive weakest-link availability; `price` is the standalone unit
// price, summed (× quantity) into each bundle's live pack summary.
export const COMPONENTS = [
  // --- Summer Essentials 3-Pack ---
  {
    id: 'shirt', code: 'LC', name: 'Linen Camp Shirt', sku: 'NB-LCS-SAGE-M', tile: 'sage',
    price: 58, stock: { la: 96, ny: 32 }, size: 'M', qty: 1,
=======
// engine can derive weakest-link availability.
export const COMPONENTS = [
  {
    id: 'shirt', code: 'LC', name: 'Linen Camp Shirt', sku: 'NB-LCS-SAGE-M', tile: 'sage',
    stock: { la: 96, ny: 32 }, size: 'M', qty: 1,
>>>>>>> Stashed changes
    swatches: [
      { color: '#9caf88', name: 'sage', selected: true },
      { color: '#c9bfa8', name: 'oat' },
      { color: '#7e8a9c', name: 'slate' },
    ],
  },
  {
    id: 'chino', code: 'PC', name: 'Pleated Chino Short', sku: 'NB-PCS-STONE-32', tile: 'sand',
<<<<<<< Updated upstream
    price: 44, stock: { la: 40, ny: 24 }, size: '32', qty: 1,
=======
    stock: { la: 40, ny: 24 }, size: '32', qty: 1,
>>>>>>> Stashed changes
    swatches: [
      { color: '#c9bfa8', name: 'stone', selected: true },
      { color: '#3a4150', name: 'navy' },
    ],
  },
  {
    id: 'tote', code: 'CT', name: 'Canvas Field Tote', sku: 'NB-CFT-NAT-OS', tile: 'sage',
<<<<<<< Updated upstream
    price: 40, stock: { la: 12, ny: 0 }, size: 'OS', qty: 1, lowAt: 14,
    swatches: [{ color: '#cdbfa6', name: 'natural', selected: true }],
  },

  // --- Nightly Reset Duo ---
  {
    id: 'mist', code: 'PM', name: 'Lavender Pillow Mist', sku: 'NB-LPM-50ML', tile: 'lilac',
    price: 32, stock: { la: 80, ny: 54 }, size: '50ml', qty: 1,
    swatches: [{ color: '#b6a8d6', name: 'lavender', selected: true }, { color: '#d9cfe8', name: 'lilac' }],
  },
  {
    id: 'mask', code: 'SM', name: 'Silk Sleep Mask', sku: 'NB-SSM-NAVY', tile: 'lilac',
    price: 28, stock: { la: 60, ny: 45 }, size: 'OS', qty: 1,
    swatches: [{ color: '#3a4150', name: 'navy', selected: true }, { color: '#d8a7b0', name: 'blush' }],
  },

  // --- Trailhead Kit ---
  {
    id: 'cap', code: 'TC', name: 'Trail Runner Cap', sku: 'NB-TRC-OLIVE', tile: 'clay',
    price: 58, stock: { la: 120, ny: 88 }, size: 'OS', qty: 1,
    swatches: [{ color: '#6f7a4e', name: 'olive', selected: true }, { color: '#2a2420', name: 'black' }],
  },
  {
    id: 'socks', code: 'HS', name: 'Merino Hiking Socks', sku: 'NB-MHS-GREY', tile: 'sand',
    price: 38, stock: { la: 140, ny: 96 }, size: 'M', qty: 1,
    swatches: [{ color: '#9b958a', name: 'grey', selected: true }, { color: '#b5713f', name: 'rust' }],
  },
  {
    id: 'flask', code: 'HF', name: 'Hydration Flask 24oz', sku: 'NB-HF24-STEEL', tile: 'teal',
    price: 78, stock: { la: 70, ny: 40 }, size: '24oz', qty: 1,
    swatches: [{ color: '#8a99a0', name: 'steel', selected: true }, { color: '#4d8088', name: 'teal' }],
  },
  {
    id: 'bandana', code: 'TB', name: 'Trail Map Bandana', sku: 'NB-TMB-RUST', tile: 'clay',
    price: 32, stock: { la: 90, ny: 60 }, size: 'OS', qty: 1,
    swatches: [{ color: '#b5713f', name: 'rust', selected: true }, { color: '#5f7a52', name: 'moss' }],
  },

  // --- Coastal Breeze Box ---
  {
    id: 'towel', code: 'BT', name: 'Linen Beach Towel', sku: 'NB-LBT-SAND', tile: 'teal',
    price: 32, stock: { la: 64, ny: 48 }, size: 'OS', qty: 1,
    swatches: [{ color: '#d9cdb2', name: 'sand', selected: true }, { color: '#9fc0c4', name: 'aqua' }],
  },
  {
    id: 'sunscreen', code: 'RS', name: 'Reef-safe Sunscreen', sku: 'NB-RSS-SPF30', tile: 'sand',
    price: 18, stock: { la: 90, ny: 70 }, size: 'SPF30', qty: 1,
    swatches: [{ color: '#e8c97a', name: 'spf 30', selected: true }],
  },
  {
    id: 'hat', code: 'WH', name: 'Woven Sun Hat', sku: 'NB-WSH-NAT', tile: 'clay',
    price: 28, stock: { la: 55, ny: 38 }, size: 'OS', qty: 1,
    swatches: [{ color: '#d8c19a', name: 'natural', selected: true }, { color: '#2a2420', name: 'black' }],
  },
  {
    id: 'oil', code: 'CO', name: 'Citrus Body Oil', sku: 'NB-CBO-100', tile: 'rose',
    price: 22, stock: { la: 75, ny: 52 }, size: '100ml', qty: 1,
    swatches: [{ color: '#e6a96b', name: 'citrus', selected: true }, { color: '#d8a7b0', name: 'rose' }],
  },
  {
    id: 'pouch', code: 'CP', name: 'Canvas Pouch', sku: 'NB-CP-NAT', tile: 'sage',
    price: 12, stock: { la: 110, ny: 84 }, size: 'OS', qty: 1,
    swatches: [{ color: '#cdbfa6', name: 'natural', selected: true }, { color: '#5f7a52', name: 'moss' }],
  },
]

// Bundles. `components` references COMPONENTS by id; the builder switches between
// them. `savePct` (bundle discount) and `subDiscount` (extra subscribe-&-save)
// drive the LIVE pack summary as quantities change. Summer Essentials is the
// inventory hero (its components feed the Inventory matrix). `subscribable`
// flags whether a Selling Plan is offered.
export const BUNDLES = [
  {
    id: 'summer', code: 'SE', name: 'Summer Essentials 3-Pack', tile: 'sage',
    components: ['shirt', 'chino', 'tote'],
    type: 'subscription', subscribable: true, savePct: 0.1549, subDiscount: 0.10,
=======
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
>>>>>>> Stashed changes
    attach: 31, status: 'NY paused', statusKind: 'warn', published: true,
  },
  {
    id: 'nightly', code: 'NR', name: 'Nightly Reset Duo', tile: 'lilac',
<<<<<<< Updated upstream
    components: ['mist', 'mask'],
    type: 'subscription', subscribable: true, savePct: 0.10, subDiscount: 0.10,
=======
    itemCount: 2, type: 'subscription', price: 54,
>>>>>>> Stashed changes
    attach: 44, status: 'All in stock', statusKind: 'ok', published: true,
  },
  {
    id: 'trailhead', code: 'TK', name: 'Trailhead Kit', tile: 'clay',
<<<<<<< Updated upstream
    components: ['cap', 'socks', 'flask', 'bandana'],
    type: 'one-time', subscribable: false, savePct: 0.0971, subDiscount: 0.10,
=======
    itemCount: 4, type: 'one-time', price: 186,
>>>>>>> Stashed changes
    attach: 22, status: 'All in stock', statusKind: 'ok', published: true,
  },
  {
    id: 'coastal', code: 'CB', name: 'Coastal Breeze Box', tile: 'teal',
<<<<<<< Updated upstream
    components: ['towel', 'sunscreen', 'hat', 'oil', 'pouch'],
    type: 'subscription', subscribable: true, savePct: 0.125, subDiscount: 0.10,
=======
    itemCount: 5, type: 'subscription', price: 98,
>>>>>>> Stashed changes
    attach: 28, status: 'All in stock', statusKind: 'ok', published: true,
  },
]

<<<<<<< Updated upstream
// Hero bundle whose components populate the Inventory matrix.
export const INVENTORY_HERO = 'summer'

=======
>>>>>>> Stashed changes
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
