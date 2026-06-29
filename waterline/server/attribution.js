// Per-product ad-spend attribution — BUILD_SPEC.md §4 ("the make-or-break").
//
// Ad platforms report spend at the ad / campaign level. To compute TRUE margin we
// must push that spend down to individual products. Strategy, in priority order:
//   1. FEED  — the ad object is tied to a product id (Meta/Google Shopping feed). Direct.
//   2. UTM   — parse the ad's landing URL → product handle.
//   3. ORDER — fallback: split a campaign's spend across the products in its
//              attributed orders, weighted by each product's revenue.
// The method used is recorded per data point and degrades the confidence score,
// so the UI can show how trustworthy each product's ad number is.

export const METHOD = { FEED: 'feed', UTM: 'utm', ORDER: 'order' }
export const METHOD_CONFIDENCE = { feed: 'high', utm: 'medium', order: 'low' }
export const METHOD_WEIGHT = { feed: 1, utm: 0.75, order: 0.4 } // for the blended confidence score

// Parse a landing URL like https://shop.com/products/merino-tee?utm... → "merino-tee"
export function handleFromUrl(url) {
  if (!url) return null
  const m = String(url).match(/\/products\/([^/?#]+)/i)
  return m ? m[1].toLowerCase() : null
}

// adRecords: [{ id, platform, campaign, spend, productId?, landingUrl?, orderIds?, attributedRevenue? }]
// ctx: { products:[{id,handle?}], handleToId?:{}, ordersById?:{ id: { lines:[{productId, revenue}] } } }
// Returns { byProduct: { [productId]: {spend, attributedRevenue, methods:Set, confidence} }, unattributed }
export function attribute(adRecords, ctx = {}) {
  const handleToId = ctx.handleToId || Object.fromEntries((ctx.products || []).filter((p) => p.handle).map((p) => [p.handle.toLowerCase(), p.id]))
  const ordersById = ctx.ordersById || {}
  const byProduct = {}
  let unattributed = 0

  const add = (pid, spend, rev, method) => {
    if (!byProduct[pid]) byProduct[pid] = { spend: 0, attributedRevenue: 0, methods: new Set() }
    byProduct[pid].spend += spend
    byProduct[pid].attributedRevenue += rev
    byProduct[pid].methods.add(method)
  }

  for (const ad of adRecords) {
    const spend = Number(ad.spend) || 0
    const adRev = Number(ad.attributedRevenue) || 0

    // 1. feed match
    if (ad.productId) { add(ad.productId, spend, adRev, METHOD.FEED); continue }

    // 2. UTM / landing-page match
    const handle = handleFromUrl(ad.landingUrl)
    const viaHandle = handle && handleToId[handle]
    if (viaHandle) { add(viaHandle, spend, adRev, METHOD.UTM); continue }

    // 3. order-level fallback — split across products in attributed orders by revenue
    const lines = (ad.orderIds || []).flatMap((oid) => ordersById[oid]?.lines || [])
    const totalRev = lines.reduce((a, l) => a + (Number(l.revenue) || 0), 0)
    if (lines.length && totalRev > 0) {
      // aggregate revenue per product within the attributed orders
      const revByProduct = {}
      for (const l of lines) revByProduct[l.productId] = (revByProduct[l.productId] || 0) + (Number(l.revenue) || 0)
      for (const [pid, rev] of Object.entries(revByProduct)) {
        const share = rev / totalRev
        add(pid, spend * share, adRev * share, METHOD.ORDER)
      }
      continue
    }

    unattributed += spend
  }

  // resolve a single confidence per product from the methods that touched it (worst wins)
  for (const pid of Object.keys(byProduct)) {
    const methods = byProduct[pid].methods
    const worst = methods.has(METHOD.ORDER) ? 'order' : methods.has(METHOD.UTM) ? 'utm' : 'feed'
    byProduct[pid].confidence = METHOD_CONFIDENCE[worst]
    byProduct[pid].methods = [...methods]
    byProduct[pid].spend = Math.round(byProduct[pid].spend * 100) / 100
    byProduct[pid].attributedRevenue = Math.round(byProduct[pid].attributedRevenue * 100) / 100
    byProduct[pid].roas = byProduct[pid].spend ? Math.round((byProduct[pid].attributedRevenue / byProduct[pid].spend) * 100) / 100 : 0
  }

  return { byProduct, unattributed: Math.round(unattributed * 100) / 100 }
}

// Apply attributed spend onto enriched/seed product rows: sets `ads` and `roas`.
// Products with no attribution keep ads = 0.
export function applyAttribution(products, attribution) {
  return products.map((p) => {
    const a = attribution.byProduct[p.id] || attribution.byProduct[p.shopifyId]
    if (!a) return { ...p, ads: p.ads || 0, roas: null, adConfidence: null }
    return { ...p, ads: a.spend, roas: a.roas, adAttributedRevenue: a.attributedRevenue, adConfidence: a.confidence, adMethods: a.methods }
  })
}
