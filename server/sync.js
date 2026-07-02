// Pull live Shopify data for a connected shop and write it into the store.
// Called after OAuth install and on each orders/refunds webhook.

import { fetchShopify, mapToWaterline } from './shopify.js'
import { db, persist } from './db.js'

// creds: { shop, token }. feeRate defaults to the store's configured rate.
export async function syncFromShopify(creds, { feeRate } = {}) {
  const { products, orders } = await fetchShopify(creds)
  const mapped = mapToWaterline(products, orders, {
    feeRate: feeRate ?? db.store.fee_rate ?? 0.029,
    currency: db.store.currency || 'USD',
  })
  // replace the catalog with freshly-ingested rows
  db.products = mapped.products
  db.cogsConf = Object.fromEntries(mapped.products.map((p) => [p.id, p.cogsPerUnit != null ? 'verified' : 'missing']))
  persist.products(db, mapped.products) // no-op without DATABASE_URL
  // reflect the connected shop on the store record (health/UI show the real store,
  // not the seed name). The handle becomes a readable fallback name.
  const shop = creds.shop || process.env.SHOPIFY_SHOP
  if (shop) {
    db.store.shop_domain = shop
    if (!db.store.name || db.store.name === 'Harbor & Vine') {
      const handle = shop.replace(/\.myshopify\.com$/, '')
      db.store.name = handle.charAt(0).toUpperCase() + handle.slice(1)
    }
  }
  console.log(`[sync] ${shop || 'shop'}: ${mapped.catalog} products, ${mapped.sold} with sales`)
  return { catalog: mapped.catalog, sold: mapped.sold }
}
