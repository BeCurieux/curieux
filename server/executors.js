// Play executors — the action→API mapping from BUILD_SPEC.md §6, with reversible
// state. Each executor:
//   execute(play, ctx) → { api, prior, next }   (captures prior value for revert)
//   revert(entry)      → { api, restored }
//
// The actual platform mutations (Meta/Google pause, Shopify productUpdate /
// price_rule / variant price) are SIMULATED here — this environment must not
// mutate the real store, and ad platforms aren't connected. The contract (what
// call is made, what prior value is captured) is real; swapping the stub body
// for a live API call is the remaining work. Every execute writes an action_log
// row first (caller's responsibility) so nothing is irreversible.

// type → { api, describe, execute, revert }
export const EXECUTORS = {
  'Ad spend': {
    api: 'meta/google: adset.update(status|daily_budget)',
    execute: (play) => /\btrim\b/i.test(play.action)
      ? { api: 'ads.updateBudget', prior: { dailyBudget: '100%' }, next: { dailyBudget: '80%' } }
      : { api: 'ads.setStatus', prior: { status: 'ACTIVE' }, next: { status: 'PAUSED' } },
    revert: (entry) => ({ api: 'ads.restore', restored: entry.prior_value_json }),
  },
  Discounts: {
    api: 'shopify: priceRuleUpdate (cap %)',
    execute: () => ({ api: 'shopify.priceRuleUpdate', prior: { valuePct: null }, next: { valuePct: 10 } }),
    revert: (entry) => ({ api: 'shopify.priceRuleUpdate', restored: entry.prior_value_json }),
  },
  Returns: {
    api: 'shopify: productUpdate (PDP note / metafield)',
    execute: (play) => ({ api: 'shopify.productUpdate', prior: { sizingNote: null }, next: { sizingNote: play.detail || 'size guidance' } }),
    revert: (entry) => ({ api: 'shopify.productUpdate', restored: entry.prior_value_json }),
  },
  Shipping: {
    api: 'shopify: shippingRuleUpdate (free-ship threshold)',
    execute: () => ({ api: 'shopify.shippingRuleUpdate', prior: { freeShipThreshold: 0 }, next: { freeShipThreshold: 35 } }),
    revert: (entry) => ({ api: 'shopify.shippingRuleUpdate', restored: entry.prior_value_json }),
  },
  AOV: {
    api: 'shopify: create bundle / frequently-bought offer',
    execute: () => ({ api: 'shopify.createBundle', prior: { bundle: null }, next: { bundle: 'created' } }),
    revert: () => ({ api: 'shopify.removeBundle', restored: { bundle: null } }),
  },
  Pricing: {
    api: 'shopify: productVariantUpdate (price ±guardrail)',
    execute: () => ({ api: 'shopify.productVariantUpdate', prior: { priceDelta: 0 }, next: { priceDelta: '+3%' } }),
    revert: (entry) => ({ api: 'shopify.productVariantUpdate', restored: entry.prior_value_json }),
  },
}

export function executorFor(type) {
  return EXECUTORS[type] || null
}
