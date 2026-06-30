// Shopify Billing API — the hybrid Autopilot+ plan ($299/mo recurring + 12% of
// recovered margin as usage charges). Charges appear on the merchant's normal
// Shopify invoice; no separate card.
//
// Flow: subscribe() creates an app subscription and returns a confirmationUrl →
// redirect the merchant there to approve → Shopify calls our return URL. The 12%
// is billed as usage records against the subscription's usage line whenever the
// Impact Ledger verifies recovered margin (recordRecoveryFee).
//
// Inert without SHOPIFY_API_KEY/SECRET + a real {shop, token}; the standalone app
// keeps using the toast fallback.

const API_VERSION = process.env.SHOPIFY_API_VERSION || '2025-01'
const APP_URL = process.env.APP_URL || 'http://localhost:8787'
// Use Shopify test charges off production. Default true unless explicitly 'false'.
const TEST_CHARGES = process.env.SHOPIFY_BILLING_TEST !== 'false'

export const AUTOPILOT_PLUS = {
  name: 'Waterline Autopilot+',
  recurring: { amount: 299, currencyCode: 'USD', interval: 'EVERY_30_DAYS' },
  usage: { terms: '12% of verified recovered margin', capAmount: 5000, currencyCode: 'USD', rate: 0.12 },
}

async function gql(shop, token, query, variables = {}) {
  const res = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify({ query, variables }),
  })
  const json = await res.json()
  if (json.errors) throw new Error('Billing GraphQL error: ' + JSON.stringify(json.errors))
  return json.data
}

// Create the Autopilot+ subscription; returns { confirmationUrl, id }.
export async function subscribe(shop, token) {
  const mutation = `mutation Create($name:String!,$url:URL!,$test:Boolean,$items:[AppSubscriptionLineItemInput!]!){
    appSubscriptionCreate(name:$name, returnUrl:$url, test:$test, lineItems:$items){
      confirmationUrl
      appSubscription { id }
      userErrors { field message }
    }
  }`
  const items = [
    { plan: { appRecurringPricingDetails: { price: { amount: AUTOPILOT_PLUS.recurring.amount, currencyCode: AUTOPILOT_PLUS.recurring.currencyCode }, interval: AUTOPILOT_PLUS.recurring.interval } } },
    { plan: { appUsagePricingDetails: { terms: AUTOPILOT_PLUS.usage.terms, cappedAmount: { amount: AUTOPILOT_PLUS.usage.capAmount, currencyCode: AUTOPILOT_PLUS.usage.currencyCode } } } },
  ]
  const data = await gql(shop, token, mutation, { name: AUTOPILOT_PLUS.name, url: `${APP_URL}/billing/callback?shop=${shop}`, test: TEST_CHARGES, items })
  const r = data.appSubscriptionCreate
  if (r.userErrors?.length) throw new Error(r.userErrors.map((e) => e.message).join('; '))
  return { confirmationUrl: r.confirmationUrl, id: r.appSubscription?.id }
}

// Read the active subscription + its usage line id (needed to record the 12%).
export async function getActiveSubscription(shop, token) {
  const query = `{ currentAppInstallation { activeSubscriptions { id name status lineItems { id plan { pricingDetails { __typename } } } } } }`
  const data = await gql(shop, token, query)
  const sub = data.currentAppInstallation?.activeSubscriptions?.[0]
  if (!sub) return null
  const usageLine = sub.lineItems.find((l) => l.plan?.pricingDetails?.__typename === 'AppUsagePricing')
  return { id: sub.id, name: sub.name, status: sub.status, usageLineItemId: usageLine?.id }
}

// Bill the 12% on a verified recovered amount (called when the ledger confirms it).
export async function recordRecoveryFee(shop, token, usageLineItemId, recoveredAmount) {
  const fee = Math.round(recoveredAmount * AUTOPILOT_PLUS.usage.rate * 100) / 100
  if (fee <= 0) return { skipped: true }
  const mutation = `mutation Usage($id:ID!,$desc:String!,$price:MoneyInput!){
    appUsageRecordCreate(subscriptionLineItemId:$id, description:$desc, price:$price){
      appUsageRecord { id }
      userErrors { message }
    }
  }`
  const data = await gql(shop, token, mutation, {
    id: usageLineItemId,
    desc: `Waterline 12% on ${AUTOPILOT_PLUS.usage.currencyCode} ${recoveredAmount} recovered margin`,
    price: { amount: fee, currencyCode: AUTOPILOT_PLUS.usage.currencyCode },
  })
  const r = data.appUsageRecordCreate
  if (r.userErrors?.length) throw new Error(r.userErrors.map((e) => e.message).join('; '))
  return { fee, id: r.appUsageRecord?.id }
}
