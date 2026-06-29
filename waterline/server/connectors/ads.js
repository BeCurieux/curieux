// Ad-platform connector interface + Meta/Google stubs.
//
// Each connector exposes fetchSpend({ since, until }) and returns a normalized
// array of ad records the attribution engine understands:
//   { id, platform, campaign, spend, productId?, landingUrl?, orderIds?, attributedRevenue? }
//
// Real OAuth + API calls live behind these. They are intentionally stubbed: this
// environment has no Meta/Google credentials, so fetchSpend throws unless the
// relevant env vars are set. Wiring the real calls is the remaining work — the
// attribution engine and the rest of the pipeline are already built to consume
// whatever these return.

export const PLATFORMS = ['meta', 'google']

// Meta Marketing API — Insights at ad level, mapped to products via catalog
// (product_id on the ad's product set) or the ad's destination URL (UTM).
export const metaConnector = {
  platform: 'meta',
  configured: () => !!process.env.META_ACCESS_TOKEN && !!process.env.META_AD_ACCOUNT_ID,
  async fetchSpend(/* { since, until } */) {
    if (!this.configured()) throw new Error('Meta not connected: set META_ACCESS_TOKEN and META_AD_ACCOUNT_ID.')
    // TODO: GET /v20.0/act_{id}/insights?level=ad&fields=spend,actions,...&time_range=...
    // then map each row → { platform:'meta', campaign, spend, productId|landingUrl, attributedRevenue }
    throw new Error('Meta fetchSpend not implemented — OAuth + Insights call goes here.')
  },
}

// Google Ads API — spend + conversions by campaign/asset group; Shopping feed
// ties spend to product ids, otherwise fall back to final URL (UTM) / order-level.
export const googleConnector = {
  platform: 'google',
  configured: () => !!process.env.GOOGLE_ADS_DEVELOPER_TOKEN && !!process.env.GOOGLE_ADS_CUSTOMER_ID,
  async fetchSpend(/* { since, until } */) {
    if (!this.configured()) throw new Error('Google Ads not connected: set GOOGLE_ADS_DEVELOPER_TOKEN and GOOGLE_ADS_CUSTOMER_ID.')
    // TODO: GAQL on shopping_performance_view / asset_group → spend + conversions by product
    throw new Error('Google fetchSpend not implemented — OAuth + GAQL call goes here.')
  },
}

export const connectors = { meta: metaConnector, google: googleConnector }

// Pull spend from every configured connector; skip the ones without creds.
export async function fetchAllSpend(window) {
  const out = []
  for (const c of Object.values(connectors)) {
    if (!c.configured()) continue
    out.push(...(await c.fetchSpend(window)))
  }
  return out
}
