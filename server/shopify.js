// Shopify ingestion — pulls the real catalog (+ COGS) and orders from the Admin
// GraphQL API and maps them into Waterline's product/margin model.
//
// Two ways it's used:
//   1. Live (production): adminGraphql() against the store using OAuth creds in
//      env (SHOPIFY_SHOP, SHOPIFY_ADMIN_TOKEN). buildFromShopify() paginates and
//      maps. Requires scopes: read_products, read_inventory, read_orders.
//   2. Snapshot (here): a real snapshot captured from the store lives in
//      shopify-snapshot.json so the app runs on real data without credentials.
//      Regenerate it with `node server/build-snapshot.mjs`.
//
// Ad spend is NOT available from Shopify — `ads` stays 0 until Meta/Google are
// connected (BUILD_SPEC.md §4). Shopify gives shipping *charged*, not fulfillment
// *cost*, so ship-cost is left 0 here and flagged; wire real postage cost later.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dir = dirname(fileURLToPath(import.meta.url))

const API_VERSION = process.env.SHOPIFY_API_VERSION || '2025-01'

// Validated against the Admin schema (read_products, read_inventory).
export const PRODUCTS_QUERY = `query Products($first:Int!,$after:String){
  products(first:$first, after:$after){
    edges{ node{
      id title productType status
      priceRangeV2{ minVariantPrice{ amount } }
      variants(first:1){ edges{ node{ price inventoryItem{ unitCost{ amount } } } } }
    } }
    pageInfo{ hasNextPage endCursor }
  }
}`

// Validated against the Admin schema (read_orders, read_products, read_inventory).
export const ORDERS_QUERY = `query Orders($first:Int!,$after:String,$q:String){
  orders(first:$first, after:$after, query:$q){
    edges{ node{
      id name createdAt
      subtotalPriceSet{ shopMoney{ amount } }
      totalDiscountsSet{ shopMoney{ amount } }
      totalShippingPriceSet{ shopMoney{ amount } }
      totalRefundedSet{ shopMoney{ amount } }
      lineItems(first:100){ edges{ node{
        quantity
        discountedTotalSet{ shopMoney{ amount } }
        originalTotalSet{ shopMoney{ amount } }
        product{ id title }
        variant{ id inventoryItem{ unitCost{ amount } } }
      } } }
    } }
    pageInfo{ hasNextPage endCursor }
  }
}`

const money = (set) => Number(set?.shopMoney?.amount || 0)
const num = (x) => Number(x || 0)
const shortId = (gid) => 'p' + String(gid).split('/').pop()

// --- live Admin API client ---
// creds: { shop, token } from OAuth; falls back to env (single-store/dev).
async function adminGraphql(query, variables = {}, creds = {}) {
  const shop = creds.shop || process.env.SHOPIFY_SHOP
  const token = creds.token || process.env.SHOPIFY_ADMIN_TOKEN
  if (!shop || !token) throw new Error('No Shopify credentials (pass {shop,token} or set SHOPIFY_SHOP/SHOPIFY_ADMIN_TOKEN).')
  const res = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify({ query, variables }),
  })
  const json = await res.json()
  if (json.errors) throw new Error('Shopify GraphQL error: ' + JSON.stringify(json.errors))
  return json.data
}

async function paginate(query, key, variables = {}, creds = {}) {
  const out = []
  let after = null
  do {
    const data = await adminGraphql(query, { first: 50, after, ...variables }, creds)
    const conn = data[key]
    out.push(...conn.edges.map((e) => e.node))
    after = conn.pageInfo.hasNextPage ? conn.pageInfo.endCursor : null
  } while (after)
  return out
}

export async function fetchShopify(creds = {}, { ordersQuery } = {}) {
  const products = await paginate(PRODUCTS_QUERY, 'products', {}, creds)
  const orders = await paginate(ORDERS_QUERY, 'orders', { q: ordersQuery || '' }, creds)
  return { products, orders }
}

// --- category colors (assigned per productType) ---
const PALETTE = ['#3E7CA6', '#6B8E4E', '#A6713E', '#7A5EA6', '#B0894A', '#0E8F5E', '#C13A34', '#2E6E8E']
function colorFor(cat, map) {
  if (!map.has(cat)) map.set(cat, PALETTE[map.size % PALETTE.length])
  return map.get(cat)
}

function shorten(title) {
  const t = title.replace(/Personali[sz]ed/gi, '').replace(/\s+\|.*$/, '').replace(/™/g, '').trim()
  return t.length > 18 ? t.slice(0, 17) + '…' : t
}

// Map raw Shopify products + orders → Waterline product rows (window totals).
// feeRate: payment processing rate; perTxnFee added per order. Proportional
// allocation of order-level discount / shipping-charged / refund / fees across
// line items by line revenue share.
export function mapToWaterline(products, orders, { feeRate = 0.0175, perTxnFee = 0.3, currency = 'AUD' } = {}) {
  const colors = new Map()

  // catalog → base rows (0 sales until orders fill them)
  const rows = new Map()
  for (const p of products) {
    const v = p.variants?.edges?.[0]?.node
    const cogsPerUnit = num(v?.inventoryItem?.unitCost?.amount)
    const cat = p.productType || 'Other'
    rows.set(p.id, {
      id: shortId(p.id), shopifyId: p.id, name: p.title, short: shorten(p.title),
      cat, catColor: colorFor(cat, colors),
      units: 0, rev: 0, cogs: 0, ship: 0, fees: 0, ads: 0, disc: 0, ret: 0,
      cogsPerUnit, price: num(v?.price || p.priceRangeV2?.minVariantPrice?.amount),
    })
  }

  // overlay sales from orders
  for (const o of orders) {
    const lines = o.lineItems.edges.map((e) => e.node).filter((l) => l.product)
    const lineRev = lines.map((l) => money(l.originalTotalSet))
    const totalLineRev = lineRev.reduce((a, b) => a + b, 0) || 1
    const orderDisc = money(o.totalDiscountsSet)
    const orderRefund = money(o.totalRefundedSet)
    const charged = money(o.subtotalPriceSet) + money(o.totalShippingPriceSet)
    const orderFee = charged * feeRate + perTxnFee

    lines.forEach((l, i) => {
      const share = lineRev[i] / totalLineRev
      let row = rows.get(l.product.id)
      if (!row) {
        const cat = 'Other'
        row = { id: shortId(l.product.id), shopifyId: l.product.id, name: l.product.title, short: shorten(l.product.title), cat, catColor: colorFor(cat, colors), units: 0, rev: 0, cogs: 0, ship: 0, fees: 0, ads: 0, disc: 0, ret: 0, cogsPerUnit: num(l.variant?.inventoryItem?.unitCost?.amount), price: 0 }
        rows.set(l.product.id, row)
      }
      const unitCost = num(l.variant?.inventoryItem?.unitCost?.amount) || row.cogsPerUnit
      row.units += l.quantity
      row.rev += lineRev[i]
      row.cogs += unitCost * l.quantity
      row.disc += orderDisc * share
      row.ret += orderRefund * share
      row.fees += orderFee * share
      // ship cost left 0 (Shopify exposes shipping charged, not fulfillment cost)
    })
  }

  // round money fields
  const round = (n) => Math.round(n * 100) / 100
  const all = [...rows.values()].map((r) => ({
    ...r, rev: round(r.rev), cogs: round(r.cogs), disc: round(r.disc), ret: round(r.ret), fees: round(r.fees), cogsPerUnit: round(r.cogsPerUnit),
  }))

  return {
    source: 'shopify',
    currency,
    feeRate,
    products: all,
    sold: all.filter((r) => r.units > 0).length,
    catalog: all.length,
  }
}

export function loadSnapshot() {
  const raw = readFileSync(join(__dir, 'shopify-snapshot.json'), 'utf8')
  return JSON.parse(raw)
}
