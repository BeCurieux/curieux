# Lattice

Bundle & subscription app for Shopify merchants, **by Sounding Labs**. A faithful
React + Vite re-creation of the `Lattice - Sounding Labs.dc.html` design prototype
(all seven screens, the nav state, and the interactions) **plus a backend
skeleton** — an in-memory store + engine with the signature *weakest-link
inventory gating* and a reversible action log.

It lives in its own subdirectory and is independent of the `curieux` app at the
repo root (and a sibling to `waterline/`).

Lattice is the embedded **merchant admin** UI — not the storefront widget. The
fictional merchant is "Northbound Supply Co." with the hero bundle "Summer
Essentials 3-Pack."

## Run

```bash
cd lattice
npm install

# frontend (runs standalone on local sample data)
npm run dev      # http://localhost:5175
npm run build    # production build to dist/
npm run preview  # serve the build

# backend API (optional — same data, served over REST)
npm run server   # http://localhost:8788
```

To make the frontend talk to the live backend instead of local sample data, set
`VITE_API_BASE` (e.g. `VITE_API_BASE=http://localhost:8788 npm run dev`) — see
`src/lib/api.js`. With it unset, the UI runs entirely client-side.

Fonts (Bricolage Grotesque + Hanken Grotesk) load from Google Fonts via
`index.html`. Self-host for production.

## Screens

State key `screen ∈ home | bundles | feeds | subs | inventory | performance |
analytics`, default `home`. Clicking a sidebar item (or an in-screen link/button
that targets a screen — "+ New bundle", "View inventory", "Manage all →") swaps
the main pane; the active nav item restyles.

1. **Home** — daily dashboard: out-of-stock alert banner, four KPIs, your
   bundles list, "needs attention", and the dark revenue card.
2. **Bundles** — the bundle builder: product rows with live swatches/size and
   quantity steppers, one-time vs subscribe pricing with cadence chips, a dark
   pack-summary, ad-readiness, and the Lighthouse card.
3. **Ad feeds** — three channel cards (Meta / Google / Pinterest), the feed
   schema mapping table, and the sync log. "Re-sync now" is wired.
4. **Subscriptions** — MRR / active / paused / churn KPIs, upcoming renewals,
   and selling plans.
5. **Inventory** — per-warehouse component stock matrix with **weakest-link
   gating**, a routing toggle, and the LA-shippable / NY-blocked result row.
6. **Performance** — the 99 Lighthouse score, a 2×2 metric grid, and a
   load-size comparison vs legacy bundle apps.
7. **Analytics** — bundle KPIs, a weekly stacked revenue chart (one-time over
   subscription), and a ranked top-bundles list.

## Brand

The prototype's warm terracotta-on-cream identity is preserved, with a few
**restrained** softening touches per the product direction ("like the mock, a
touch more feminine — not too much"): a dusty-rose secondary accent used
sparingly (logo gradient, avatar, a soft active-nav rail), and barely-there
blush warmth in the page + app-card backgrounds. Layout, copy, and the core
terracotta / green / warning system are unchanged. All tokens live in
`src/lib/styles.js` (`T`).

## Architecture

- `src/lib/data.js` — static sample data (bundles, components, channels, feed
  schema, subscriptions, inventory, performance, analytics). In production these
  come from Shopify Admin GraphQL + your own services.
- `src/lib/compute.js` — shared derivations: **weakest-link** bundle
  availability + the inventory matrix. One source of truth for the gating math.
- `src/lib/styles.js` — design tokens (`T`) + inline-style builders (nav items,
  chips, toggles, buttons, monograms, pills).
- `src/hooks/useLattice.js` — all app state + the derived render values (the
  React port of the prototype's `renderVals()`): nav, warehouse filter, routing
  toggle, cadence/quantity/swatch selection, and toasts.
- `src/components/` — `Topbar`, `Sidebar`, `Toast`, shared `Bits` (screen
  header, KPI cards, monogram), `Icons`; `screens/` holds the seven screens.
- `src/lib/api.js` — client for the backend API (used when `VITE_API_BASE` set).

## Backend skeleton (`server/`)

A small Express API that serves the same data over REST. It **reuses
`src/lib/data.js`** so the sample data has a single source of truth shared with
the frontend.

- `server/db.js` — in-memory store seeded from `data.js` (store, warehouses,
  components with mutable per-warehouse stock, bundles, channels, plans, …) plus
  an append-only **action log**. Swap this module for a real database in
  production.
- `server/engine.js` — read views for every screen, **weakest-link availability
  derivation** (mirrors `compute.js`), and mutations (warehouse routing toggle,
  component stock set, feed re-sync). Every mutation writes the action log with
  prior→new values.
- `server/server.js` — the Express routes.

Key endpoints: `GET /api/home`, `/api/bundles`, `/api/bundles/:id`, `/api/feeds`,
`/api/subscriptions`, `/api/inventory`, `/api/performance`, `/api/analytics`,
`/api/action-log`; mutations `POST /api/feeds/resync`,
`/api/inventory/routing`, `/api/inventory/:id/stock`.

Toggling a component to 0 stock in a region and re-reading `/api/inventory`
shows the hero bundle flip to **blocked** in that region (gated by the weakest
component) — the same rule the Inventory screen renders.

## Still ahead (next phases)

The store is in-memory and seeded with sample data. The remaining production
work: real **Shopify OAuth + Admin GraphQL ingestion** (products, variants,
inventory levels, selling plans) replacing the seed; a persistent database;
real **feed connectors** (Meta/Google/Pinterest catalog APIs) behind
`/api/feeds/resync`; the storefront **bundle widget** (the 11 kb vanilla-JS
async widget the Performance screen sells) and **Shopify Functions** pricing;
and **atomic uninstall** (purge variants/assets/theme blocks). The route surface
and action-log machinery here are built to receive those.

## Files map to the prototype

`Lattice - Sounding Labs.dc.html` is the visual + behavioral source of truth;
every measurement, colour, and copy string in these screens is taken from it.
`support.js` (the `.dc.html` preview harness) is **not** part of this app.
