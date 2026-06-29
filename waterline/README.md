# Waterline — frontend prototype

Margin intelligence + autopilot for Shopify merchants. This is a faithful React + Vite
re-creation of the `Waterline.dc.html` design prototype: every screen, state, and
interaction, wired to a single in-memory margin compute pipeline.

It lives in its own subdirectory and is independent of the `curieux` app at the repo root.

## Run

```bash
cd waterline
npm install
npm run dev      # http://localhost:5174
npm run build    # production build to dist/
npm run preview  # serve the build
```

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

## Not in this prototype (the backend)

Per the agreed scope, this is the **frontend only**. The data is mocked and no
external services are called. The production build order — Shopify/Meta/Google OAuth
+ ingestion, the materialized margin pipeline, Autopilot action executors with
reversible logging, server-side guardrails, the alert rule engine, and billing —
is described in the engineering spec and is the next phase.
