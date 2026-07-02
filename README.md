# Waterline

Margin intelligence + autopilot for Shopify merchants. A faithful React + Vite
re-creation of the `Waterline.dc.html` design prototype (every screen, state, and
interaction) **plus a backend skeleton** — a server-side margin engine + REST API
with server-side guardrails and a reversible action log.

It lives in its own subdirectory and is independent of the `curieux` app at the repo root.

## Run

```bash
cd waterline
npm install

# frontend (runs standalone on local mock data)
npm run dev      # http://localhost:5174
npm run build    # production build to dist/
npm run preview  # serve the build

# backend API (optional — same margin formula, served over REST)
npm run server                          # http://localhost:8787 (Harbor & Vine seed data)
WATERLINE_DATA=shopify npm run server   # serves REAL data from shopify-snapshot.json
```

## Real Shopify data (`server/shopify.js`)

The backend can serve **real ingested data** from the connected store instead of
the seed. A snapshot captured from the live store **Mamacita & Crew** (29 products
with real cost-per-item, in AUD) lives in `server/shopify-snapshot.json`; run the
API with `WATERLINE_DATA=shopify` to use it.

- `server/shopify.js` — validated Admin GraphQL queries (products + COGS, orders),
  a live `fetchShopify()` client (env `SHOPIFY_SHOP` + `SHOPIFY_ADMIN_TOKEN`,
  scopes `read_products`/`read_inventory`/`read_orders`), and `mapToWaterline()`
  which aggregates orders into per-product margin rows (allocating order-level
  discount / fees / refunds across line items by revenue share).
- `server/build-snapshot.mjs` — regenerates the snapshot from captured data; in
  production you'd call `fetchShopify()` → `mapToWaterline()` → write.
- Notes: **ad spend is 0** until Meta/Google are connected (BUILD_SPEC §4), and
  Shopify exposes shipping *charged*, not fulfillment *cost*, so ship-cost is 0
  and flagged. Real COGS from Shopify counts as `verified` confidence.

To make the frontend talk to the live backend instead of local mock data, set
`VITE_API_BASE` (e.g. `VITE_API_BASE=http://localhost:8787 npm run dev`) — see
`src/lib/api.js`. With it unset, the UI runs entirely client-side.

Fonts (Hanken Grotesk + JetBrains Mono) load from Google Fonts via `index.html`.

## What's here (scope: frontend prototype)

All UI from the spec, driven by realistic sample data for the fictional store
"Harbor & Vine":

- **Margins** — KPI row, insight banner, and four sub-views: Waterline chart
  (signature bars above/below break-even), Triage table (sortable), Leak map
  (contribution waterfall + ranked leaks), and Autopilot.
- **Autopilot** — master switch, Guarded/Ask-first mode, Impact Ledger with
  before→after sparklines and one-tap revert, pending strip, automated plays with
  expandable "why this play?" reasoning + signals, activity feed, and guardrails.
- **Cost inputs** — confidence KPIs, connected sources, and a per-unit cost table
  with ± COGS steppers that recompute margins live across the whole app.
- **Alerts** — triggered-alert feed with severity rails + dismiss, and toggleable
  alert rules.
- **Plans & billing** — monthly/annual toggle, three plan cards, value-based ROI
  proof panel, enterprise strip.
- **Product drawer** — slide-over with margin-breakdown waterfall, plays or
  opportunities, and actions.
- **Onboarding overlay** — 4-step setup with a progress tracker and gated Continue.
- **Toast** notifications for every action.

The date-range control (30d / 90d / 12mo), sorting, COGS overrides, Autopilot
toggles, ledger reverts, and onboarding all behave as documented in the handoff.

## Architecture

- `src/lib/data.js` — static sample data (products, plays, ledger, alerts, sources…).
  In production these come from the ingestion pipeline (see the build spec).
- `src/lib/compute.js` — the single margin pipeline: `enrich()`, `waterfall()`, and
  the money/percent formatters. Mirrors the margin formula in the build spec.
- `src/lib/styles.js` — shared inline-style builders (segmented controls, toggles,
  nav items, buttons).
- `src/hooks/useWaterline.js` — all app state + the derived "render values" object
  (the React port of the prototype's `renderVals()`). One source of truth, so an
  edited COGS or a changed range cascades everywhere.
- `src/components/` — presentational components; `screens/` holds the four
  top-level screens and the Margins sub-views.
- `src/lib/api.js` — client for the backend API (used when `VITE_API_BASE` is set).

## Backend skeleton (`server/`)

A small Express API that serves the same numbers over REST. It **reuses
`src/lib/compute.js` and `src/lib/data.js`** so the margin formula and seed data
have a single source of truth shared with the frontend.

- `server/db.js` — in-memory store seeded from `data.js`, shaped like the data
  model in the spec (store, products, plays, ledger, alerts, rules) plus an
  append-only **action log**. Swap this module for a real database in production.
- `server/engine.js` — margin rollups, product detail, the Autopilot view,
  **server-side guardrail enforcement**, cost-input confidence, and all mutations
  (COGS override, play toggle, ledger revert, etc.). Every mutation writes the
  action log with prior→new values so it's reversible.
- `server/server.js` — the Express routes.

Key endpoints: `GET /api/margins`, `/api/products/:id`, `/api/cost-inputs`,
`/api/autopilot`, `/api/alerts`, `/api/action-log`; mutations under
`POST /api/cost-inputs/:id/cogs`, `/api/autopilot/plays/:id/toggle`, etc. All
read endpoints accept `?range=30d|90d|12mo`.

**Guardrails are enforced server-side** (spec §7): e.g. toggling a play whose
projected impact exceeds the $5,000 auto-approval limit returns
`{ routedToApproval: true, reasons: [...] }` and does *not* mutate state —
mirroring "a play that would violate a guardrail is routed to needs-approval."

## Ad-spend attribution (`server/attribution.js`)

The hard part of true margin (BUILD_SPEC §4): pushing ad spend down to individual
products. `attribute()` maps platform spend to products via three tiers, recording
the method and degrading confidence accordingly:

1. **feed** — ad tied to a product id (Meta catalog / Google Shopping). High confidence.
2. **utm** — ad landing URL → product handle. Medium.
3. **order** — fallback: split a campaign's spend across its attributed orders'
   products, weighted by revenue. Low.

It computes per-product **ROAS** and tracks **unattributed** spend (never silently
dropped). `server/connectors/ads.js` defines the Meta/Google connector interface
(real OAuth plugs in there; stubbed until credentials exist). When `db.adSpend` is
populated, the engine injects attributed spend before computing margin and surfaces
`roas` + `adConfidence` per product — verified end-to-end (a $30 feed-matched ad
drops the sample sale's margin 49.3% → 24.1%, ROAS 3.97).

Tests: `node server/attribution.test.mjs` (12 assertions across all three tiers).

## Still ahead (next phases)

The store is in-memory and seeded with mock data. The remaining production work
from the engineering spec: real **Shopify + Meta/Google OAuth and ingestion**
(replacing the seed), a persistent database + materialized `margins` table, real
**Autopilot action executors** (the API calls that actually pause ads / cap
discounts, with revert), the **alert rule engine + delivery** (email/Slack), and
**billing**. The route surface and guardrail/action-log machinery here are built
to receive those.
