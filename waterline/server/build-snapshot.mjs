// Regenerates shopify-snapshot.json from real data captured from the connected
// store "Mamacita & Crew" (Admin GraphQL, AUD). The RAW arrays below are exactly
// what the products/orders queries returned — re-run this after a fresh pull to
// refresh the snapshot. In production you'd call fetchShopify() instead of
// embedding, then mapToWaterline() + write the file.

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mapToWaterline } from './shopify.js'

const __dir = dirname(fileURLToPath(import.meta.url))

// [shopifyId, title, productType, price, unitCost]
const RAW = [
  ['gid://shopify/Product/14924838961515', 'Luxury Hardcover Journal | Mamacita Personalized', 'Journal', 40.0, 18.55],
  ['gid://shopify/Product/14924842893675', 'Classic Mamacita White Ceramic Mug', 'MUG', 13.5, 8.36],
  ['gid://shopify/Product/14929619878251', 'Mamacita Black Glossy Mug | Personalized Ceramic Mug', 'MUG', 17.5, 11.37],
  ['gid://shopify/Product/14929620205931', 'Mamacita Note Pads | Personalized Stationery', 'Post It Notes', 13.5, 8.73],
  ['gid://shopify/Product/14929620435307', 'Mamacita Candle | Signature Scent - Personalized Soy Candle', 'CANDLE', 24.5, 16.12],
  ['gid://shopify/Product/14929639833963', 'Mamacita Eco Tote Bag | Personalized Embroidered Tote', 'Bag', 38.0, 25.18],
  ['gid://shopify/Product/14929640194411', 'Bebecito Baby Onesie', 'BABY ONESIE', 41.5, 22.82],
  ['gid://shopify/Product/14929640522091', 'Bebecito Baby T-Shirt', 'T-SHIRT', 26.5, 17.58],
  ['gid://shopify/Product/14929641144683', 'Bebecita Baby Onesie', 'BABY ONESIE', 41.5, 22.82],
  ['gid://shopify/Product/14930786713963', 'Mamacita hoodie', 'Hoodie', 50.5, 33.43],
  ['gid://shopify/Product/14930791039339', 'Papacito hoodie', 'Hoodie', 43.5, 33.43],
  ['gid://shopify/Product/14931330597227', 'Mamacita Everyday t-shirt', 'T-SHIRT', 31.5, 20.75],
  ['gid://shopify/Product/14931333349739', 'Bebecita jersey t-shirt', 'Apparel', 28.5, 17.95],
  ['gid://shopify/Product/14931352093035', 'Mamacita Long Sleeve Shirt', 'T-SHIRT', 72.5, 43.75],
  ['gid://shopify/Product/14931368051051', 'Mamacita Baseball Cap', 'CAP', 35.5, 23.45],
  ['gid://shopify/Product/14931368345963', 'Papacito Baseball Cap', 'CAP', 35.5, 23.45],
  ['gid://shopify/Product/14931368706411', 'Papacito Long Sleeve Shirt', 'Sweatshirt', 77.0, 43.75],
  ['gid://shopify/Product/14931391742315', 'Chiquito Toddler T-Shirt', 'T-SHIRT', 28.5, 18.95],
  ['gid://shopify/Product/14931396297067', 'Chiquita Toddler and Kids T-Shirt', 'T-SHIRT', 28.5, 18.95],
  ['gid://shopify/Product/14931397837163', 'Bebecita Baby T-Shirt', 'T-SHIRT', 27.0, 17.95],
  ['gid://shopify/Product/14935092167019', 'PRINTFUL Mamacita™ Signature Sweatshirt', 'Sweatshirt', 119.0, 41.25],
  ['gid://shopify/Product/14936529600875', 'Mamacita™ Signature Sweatshirt', 'Sweatshirt', 99.0, 40.15],
  ['gid://shopify/Product/14941843259755', '[alternate] Made for Her Mamacita™ Sweatshirt personalised', 'Sweatshirt', 129.0, 44.1],
  ['gid://shopify/Product/14943833817451', 'Made for Her Mamacita™ Personalised Sweatshirt', 'Sweatshirt', 129.0, 44.1],
  ['gid://shopify/Product/14946266055019', 'Made for Her Mamacita™ Personalised Sweatshirt', 'Sweatshirt', 99.0, 44.1],
  ['gid://shopify/Product/14947110060395', 'Made for Her Mamacita™ Personalized Sweatshirt', 'Sweatshirt', 99.0, 31.77],
  ['gid://shopify/Product/14947569860971', 'Mamacita™ Signature Sweatshirt', 'Sweatshirt', 99.0, 29.37],
  ['gid://shopify/Product/14947759522155', 'Mamacita™ Signature Tee', 'T-Shirt', 59.0, 16.35],
  ['gid://shopify/Product/14957724434795', 'Chiquito / Chiquita Kids Crewneck T-shirt', 'Print Material', 49.0, 19.52],
]

const products = RAW.map(([id, title, productType, price, cost]) => ({
  id, title, productType, status: 'ARCHIVED',
  priceRangeV2: { minVariantPrice: { amount: String(price) } },
  variants: { edges: [{ node: { price: String(price), inventoryItem: { unitCost: { amount: String(cost) } } } }] },
}))

// Real order #1001
const orders = [{
  id: 'gid://shopify/Order/11225849495915', name: '#1001', createdAt: '2026-03-29T04:47:39Z',
  subtotalPriceSet: { shopMoney: { amount: '101.15' } },
  totalDiscountsSet: { shopMoney: { amount: '17.85' } },
  totalShippingPriceSet: { shopMoney: { amount: '14.91' } },
  totalRefundedSet: { shopMoney: { amount: '0.0' } },
  lineItems: { edges: [{ node: {
    quantity: 1,
    discountedTotalSet: { shopMoney: { amount: '119.0' } },
    originalTotalSet: { shopMoney: { amount: '119.0' } },
    product: { id: 'gid://shopify/Product/14936529600875', title: 'Mamacita™ Signature Sweatshirt' },
    variant: { id: 'gid://shopify/ProductVariant/53032891515243', inventoryItem: { unitCost: { amount: '40.15' } } },
  } }] },
}]

// AUD Shopify Payments domestic ≈ 1.75% + A$0.30
const snapshot = {
  store: { id: 'mamacita-crew', shop_domain: 'www.mamacitaandcrew.com.au', name: 'Mamacita & Crew', currency: 'AUD', fee_rate: 0.0175 },
  capturedAt: '2026-03-29',
  ...mapToWaterline(products, orders, { feeRate: 0.0175, perTxnFee: 0.3, currency: 'AUD' }),
}

writeFileSync(join(__dir, 'shopify-snapshot.json'), JSON.stringify(snapshot, null, 2))
console.log(`Wrote shopify-snapshot.json — ${snapshot.catalog} products, ${snapshot.sold} with sales.`)
