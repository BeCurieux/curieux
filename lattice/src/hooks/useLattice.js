import { useEffect, useRef, useState } from 'react'
import {
  STORE, WAREHOUSES, BUNDLES, COMPONENTS, HOME_KPIS, HOME_ATTENTION, CADENCES,
  CHANNELS, FEED_SCHEMA, SYNC_LOG, SUBS_KPIS, RENEWALS, SELLING_PLANS,
  PERF_SCORE, PERF_METRICS, PERF_COMPARISON, ANALYTICS_KPIS, REVENUE_BY_WEEK, TOP_BUNDLES,
<<<<<<< Updated upstream
  INVENTORY_HERO,
} from '../lib/data.js'
import { inventoryMatrix, shippableCount, packSummary, componentById } from '../lib/compute.js'
=======
} from '../lib/data.js'
import { inventoryMatrix, shippableCount, bundleAvailability } from '../lib/compute.js'
>>>>>>> Stashed changes
import { navItem, navRail } from '../lib/styles.js'

// Seven screens, default Home. Clicking a sidebar item (or an in-screen link
// that targets a screen) swaps the main pane — the React port of the
// prototype's single `screen` state value.
const SCREENS = ['home', 'bundles', 'feeds', 'subs', 'inventory', 'performance', 'analytics']

<<<<<<< Updated upstream
const money = (n) => '$' + (Number.isInteger(n) ? n.toLocaleString('en-US') : n.toFixed(2))

export default function useLattice() {
  const [state, setState] = useState({
    screen: 'home',
    // bundle builder
    activeBundle: 'summer',
    pricingMode: 'subscription', // one-time | subscription
    cadence: 'monthly',
    quantities: Object.fromEntries(COMPONENTS.map((c) => [c.id, c.qty || 1])),
    selectedSwatch: Object.fromEntries(COMPONENTS.map((c) => [c.id, (c.swatches.find((s) => s.selected) || c.swatches[0]).name])),
    // inventory
    warehouse: 'all',
    routingOn: true,
    // topbar
    query: '',
    storeMenuOpen: false,
    bellOpen: false,
    bellSeen: false,
=======
export default function useLattice() {
  const [state, setState] = useState({
    screen: 'home',
    warehouse: 'all', // inventory filter
    routingOn: true, // fulfillment warehouse routing toggle
    pricingMode: 'subscription', // bundle builder: one-time | subscription
    cadence: 'monthly',
    quantities: Object.fromEntries(COMPONENTS.map((c) => [c.id, c.qty || 1])),
    selectedSwatch: Object.fromEntries(COMPONENTS.map((c) => [c.id, (c.swatches.find((s) => s.selected) || c.swatches[0]).name])),
>>>>>>> Stashed changes
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

<<<<<<< Updated upstream
  const closeMenus = () => set({ storeMenuOpen: false, bellOpen: false })
  const go = (screen) => set({ screen, storeMenuOpen: false, bellOpen: false })
=======
  const go = (screen) => set({ screen })
>>>>>>> Stashed changes

  // ---- nav ----
  const screen = state.screen
  const nav = SCREENS.reduce((acc, key) => {
<<<<<<< Updated upstream
    acc[key] = { active: screen === key, style: navItem(screen === key), railStyle: navRail(screen === key), go: () => go(key) }
    return acc
  }, {})

  // ---- topbar search (filters the Home bundle list, live) ----
  const query = state.query.trim().toLowerCase()
  const matchesQuery = (b) => {
    if (!query) return true
    if (b.name.toLowerCase().includes(query)) return true
    return (b.components || []).some((id) => {
      const c = componentById(id)
      return c && (c.name.toLowerCase().includes(query) || c.sku.toLowerCase().includes(query))
    })
  }
  // Home bundle cards: derive item count + pack price from each bundle's
  // components (default quantities) so list + builder stay consistent.
  const homeBundles = BUNDLES.filter(matchesQuery).map((b) => {
    const sm = packSummary(b, {})
    return { id: b.id, code: b.code, tile: b.tile, name: b.name, type: b.type, attach: b.attach, status: b.status, statusKind: b.statusKind, itemCount: sm.itemCount, price: sm.price }
  })

  // ---- bundle builder (live, per active bundle) ----
  const activeBundle = BUNDLES.find((b) => b.id === state.activeBundle) || BUNDLES[0]
  const selectBundle = (id) => {
    const b = BUNDLES.find((x) => x.id === id)
    set({ activeBundle: id, pricingMode: b && b.type === 'one-time' ? 'onetime' : 'subscription' })
  }
  const summary = packSummary(activeBundle, state.quantities)

  const builderComponents = (activeBundle.components || []).map(componentById).filter(Boolean).map((c) => ({
=======
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
>>>>>>> Stashed changes
    ...c,
    qty: state.quantities[c.id],
    selectedSwatch: state.selectedSwatch[c.id],
    out: (c.stock.ny ?? 0) <= 0 || (c.stock.la ?? 0) <= 0,
<<<<<<< Updated upstream
    lineText: money((c.price || 0) * state.quantities[c.id]),
    stockLine: (c.stock.ny ?? 0) <= 0
=======
    stockLine: c.id === 'tote'
>>>>>>> Stashed changes
      ? `${c.sku} · LA ${c.stock.la} · NY ${c.stock.ny}`
      : `${c.sku} · ${(c.stock.la || 0) + (c.stock.ny || 0)} in stock`,
    dec: () => set((s) => ({ quantities: { ...s.quantities, [c.id]: Math.max(1, s.quantities[c.id] - 1) } })),
    inc: () => set((s) => ({ quantities: { ...s.quantities, [c.id]: s.quantities[c.id] + 1 } })),
    pickSwatch: (name) => set((s) => ({ selectedSwatch: { ...s.selectedSwatch, [c.id]: name } })),
  }))

<<<<<<< Updated upstream
  // bundle switcher tabs
  const bundleTabs = BUNDLES.map((b) => ({ id: b.id, name: b.name, active: b.id === activeBundle.id, select: () => selectBundle(b.id) }))

  // ---- inventory (weakest-link gating, derived) ----
  const matrix = inventoryMatrix(INVENTORY_HERO)
  const allRegions = WAREHOUSES.filter((w) => w.id !== 'all')
  const visibleRegions = state.warehouse === 'all' ? allRegions : allRegions.filter((w) => w.id === state.warehouse)
  const hero = BUNDLES.find((b) => b.id === INVENTORY_HERO)
  const results = visibleRegions.map((w) => {
    const count = shippableCount(hero, w.id)
    return { warehouse: w, count, blocked: state.routingOn && count <= 0 }
  })

=======
>>>>>>> Stashed changes
  return {
    store: STORE,
    mounted: state.mounted,
    screen,
    isHome: screen === 'home', isBundles: screen === 'bundles', isFeeds: screen === 'feeds',
    isSubs: screen === 'subs', isInventory: screen === 'inventory', isPerformance: screen === 'performance',
    isAnalytics: screen === 'analytics',
    nav, go,

<<<<<<< Updated upstream
    // topbar
    query: state.query, setQuery: (q) => set({ query: q }), clearQuery: () => set({ query: '' }),
    storeMenuOpen: state.storeMenuOpen, toggleStoreMenu: () => set((s) => ({ storeMenuOpen: !s.storeMenuOpen, bellOpen: false })),
    stores: [{ id: STORE.id, name: STORE.name, swatch: STORE.swatch, active: true }],
    connectStore: () => { closeMenus(); fireToast('Connect another store — start the Shopify install flow.') },
    bellOpen: state.bellOpen, bellSeen: state.bellSeen,
    toggleBell: () => set((s) => ({ bellOpen: !s.bellOpen, bellSeen: true, storeMenuOpen: false })),
    notifications: HOME_ATTENTION.map((a) => ({ dot: a.dot, text: a.strong + a.rest })),
    closeMenus, anyMenuOpen: state.storeMenuOpen || state.bellOpen,

    // home
    homeKpis: HOME_KPIS, homeAttention: HOME_ATTENTION,
    bundles: homeBundles, hasBundleMatches: homeBundles.length > 0, bundleQuery: state.query.trim(),

    // bundle builder
    activeBundle, summary, components: builderComponents, bundleTabs, cadences: CADENCES,
    openBundle: (id) => { selectBundle(id); go('bundles') },
    cadence: state.cadence, setCadence: (id) => set({ cadence: id }),
    pricingMode: state.pricingMode, setPricingMode: (m) => set({ pricingMode: m }),
    saveBundle: () => fireToast(`${activeBundle.name} saved — changes live on your storefront.`),
    addProduct: () => fireToast('Pick a product to add to the pack.'),
    newBundle: () => fireToast('New bundle — name it and add your first product.'),
=======
    // home
    homeKpis: HOME_KPIS, homeAttention: HOME_ATTENTION, bundles: BUNDLES,

    // bundle builder
    summer, components, cadences: CADENCES,
    cadence: state.cadence, setCadence: (id) => set({ cadence: id }),
    pricingMode: state.pricingMode, setPricingMode: (m) => set({ pricingMode: m }),
    saveBundle: () => fireToast('Bundle saved — changes live on your storefront.'),
    addProduct: () => fireToast('Pick a product to add to the pack.'),
>>>>>>> Stashed changes

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
<<<<<<< Updated upstream
    matrix, visibleRegions, results,
=======
    matrix, results,
>>>>>>> Stashed changes

    // performance
    perfScore: PERF_SCORE, perfMetrics: PERF_METRICS, perfComparison: PERF_COMPARISON,

    // analytics
    analyticsKpis: ANALYTICS_KPIS, revenueByWeek: REVENUE_BY_WEEK, topBundles: TOP_BUNDLES,

    // toast
    toast: state.toast, showToast: !!state.toast,
  }
}
