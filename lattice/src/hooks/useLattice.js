import { useEffect, useRef, useState } from 'react'
import {
  STORE, WAREHOUSES, BUNDLES, COMPONENTS, HOME_KPIS, HOME_ATTENTION, CADENCES,
  CHANNELS, FEED_SCHEMA, SYNC_LOG, SUBS_KPIS, RENEWALS, SELLING_PLANS,
  PERF_SCORE, PERF_METRICS, PERF_COMPARISON, ANALYTICS_KPIS, REVENUE_BY_WEEK, TOP_BUNDLES,
} from '../lib/data.js'
import { inventoryMatrix, shippableCount, bundleAvailability } from '../lib/compute.js'
import { navItem, navRail } from '../lib/styles.js'

// Seven screens, default Home. Clicking a sidebar item (or an in-screen link
// that targets a screen) swaps the main pane — the React port of the
// prototype's single `screen` state value.
const SCREENS = ['home', 'bundles', 'feeds', 'subs', 'inventory', 'performance', 'analytics']

export default function useLattice() {
  const [state, setState] = useState({
    screen: 'home',
    warehouse: 'all', // inventory filter
    routingOn: true, // fulfillment warehouse routing toggle
    pricingMode: 'subscription', // bundle builder: one-time | subscription
    cadence: 'monthly',
    quantities: Object.fromEntries(COMPONENTS.map((c) => [c.id, c.qty || 1])),
    selectedSwatch: Object.fromEntries(COMPONENTS.map((c) => [c.id, (c.swatches.find((s) => s.selected) || c.swatches[0]).name])),
    toast: '',
    mounted: false,
  })
  const toastT = useRef(null)

  useEffect(() => {
    const t = setTimeout(() => setState((s) => ({ ...s, mounted: true })), 60)
    return () => { clearTimeout(t); clearTimeout(toastT.current) }
  }, [])

  const set = (patch) => setState((s) => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) }))

  const fireToast = (msg) => {
    set({ toast: msg })
    clearTimeout(toastT.current)
    toastT.current = setTimeout(() => set({ toast: '' }), 2800)
  }

  const go = (screen) => set({ screen })

  // ---- nav ----
  const screen = state.screen
  const nav = SCREENS.reduce((acc, key) => {
    acc[key] = {
      active: screen === key,
      style: navItem(screen === key),
      railStyle: navRail(screen === key),
      go: () => go(key),
    }
    return acc
  }, {})

  // ---- inventory (weakest-link gating, derived) ----
  const matrix = inventoryMatrix()
  const regions = WAREHOUSES.filter((w) => w.id !== 'all')
  const summer = BUNDLES.find((b) => b.id === 'summer')
  const results = regions.map((w) => {
    const count = shippableCount(summer, w.id)
    const blocked = count <= 0
    return { warehouse: w, count, blocked }
  })

  // ---- bundle builder ----
  const components = COMPONENTS.map((c) => ({
    ...c,
    qty: state.quantities[c.id],
    selectedSwatch: state.selectedSwatch[c.id],
    out: (c.stock.ny ?? 0) <= 0 || (c.stock.la ?? 0) <= 0,
    stockLine: c.id === 'tote'
      ? `${c.sku} · LA ${c.stock.la} · NY ${c.stock.ny}`
      : `${c.sku} · ${(c.stock.la || 0) + (c.stock.ny || 0)} in stock`,
    dec: () => set((s) => ({ quantities: { ...s.quantities, [c.id]: Math.max(1, s.quantities[c.id] - 1) } })),
    inc: () => set((s) => ({ quantities: { ...s.quantities, [c.id]: s.quantities[c.id] + 1 } })),
    pickSwatch: (name) => set((s) => ({ selectedSwatch: { ...s.selectedSwatch, [c.id]: name } })),
  }))

  return {
    store: STORE,
    mounted: state.mounted,
    screen,
    isHome: screen === 'home', isBundles: screen === 'bundles', isFeeds: screen === 'feeds',
    isSubs: screen === 'subs', isInventory: screen === 'inventory', isPerformance: screen === 'performance',
    isAnalytics: screen === 'analytics',
    nav, go,

    // home
    homeKpis: HOME_KPIS, homeAttention: HOME_ATTENTION, bundles: BUNDLES,

    // bundle builder
    summer, components, cadences: CADENCES,
    cadence: state.cadence, setCadence: (id) => set({ cadence: id }),
    pricingMode: state.pricingMode, setPricingMode: (m) => set({ pricingMode: m }),
    saveBundle: () => fireToast('Bundle saved — changes live on your storefront.'),
    addProduct: () => fireToast('Pick a product to add to the pack.'),

    // feeds
    channels: CHANNELS, feedSchema: FEED_SCHEMA, syncLog: SYNC_LOG,
    resyncFeeds: () => fireToast('Re-syncing all channels — feeds will refresh in a moment.'),

    // subscriptions
    subsKpis: SUBS_KPIS, renewals: RENEWALS, sellingPlans: SELLING_PLANS,
    newSellingPlan: () => fireToast('New selling plan — choose a cadence and discount.'),
    addPlan: () => fireToast('Add a plan to start offering it on bundles.'),

    // inventory
    warehouses: WAREHOUSES, warehouse: state.warehouse, setWarehouse: (id) => set({ warehouse: id }),
    routingOn: state.routingOn, toggleRouting: () => set((s) => {
      const next = !s.routingOn
      fireToast(next ? 'Warehouse routing on — bundles hide where a component is depleted.' : 'Warehouse routing off — bundles stay visible everywhere.')
      return { routingOn: next }
    }),
    matrix, results,

    // performance
    perfScore: PERF_SCORE, perfMetrics: PERF_METRICS, perfComparison: PERF_COMPARISON,

    // analytics
    analyticsKpis: ANALYTICS_KPIS, revenueByWeek: REVENUE_BY_WEEK, topBundles: TOP_BUNDLES,

    // toast
    toast: state.toast, showToast: !!state.toast,
  }
}
