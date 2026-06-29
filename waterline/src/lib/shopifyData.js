// Real store snapshot (Mamacita & Crew) for the frontend's "live data" mode.
// Imports the same snapshot the backend serves, so the dashboard can render real
// products/COGS/margins with no server running. Regenerate via
// `node server/build-snapshot.mjs`.
import snap from '../../server/shopify-snapshot.json'

export const SHOPIFY_PRODUCTS = snap.products
export const SHOPIFY_STORE = snap.store
export const SHOPIFY_SOURCES = [
  { id: 'shopify', name: 'Shopify', detail: `Orders, products, COGS · ${snap.catalog} products`, status: 'live', icon: 'S', color: '#95BF47' },
  { id: 'meta', name: 'Meta Ads', detail: 'Not connected — ad spend unattributed', status: 'off', icon: 'M', color: '#0866FF' },
  { id: 'google', name: 'Google Ads', detail: 'Not connected — ad spend unattributed', status: 'off', icon: 'G', color: '#EA4335' },
]
