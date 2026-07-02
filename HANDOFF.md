# Waterline — session handoff

Paste this into a new Claude session (or point Claude at this file in the repo) to
continue without re-explaining anything.

## What Waterline is
Margin intelligence + autopilot for Shopify merchants: computes the true
contribution margin of every product (after ads, shipping, fees, discounts,
returns), flags "underwater" products, and acts on them with reversible,
guardrailed automations. Built from two source docs: `BUILD_SPEC.md` (engineering)
and the design prototype `Waterline.dc.html` / its README (UI).

## Where the code lives
- Everything is in the **`waterline/`** subdirectory of the `becurieux/curieux`
  repo. It is self-contained and does NOT touch the other apps in that repo
  (curieux, skippr).
- Built as **React + Vite** (frontend) + **Express** (backend skeleton).

## Status (as of this handoff)

### ✅ Done — Frontend prototype (faithful re-creation of Waterline.dc.html)
Every screen + interaction, verified in-browser:
- Margins workspace: Waterline chart, Triage table (sortable), Leak map
  (contribution waterfall + ranked leaks), Autopilot.
- Autopilot: master switch, Guarded/Ask-first, Impact Ledger with before→after
  sparklines + one-tap revert, pending strip, plays with "why this play?"
  reasoning + signals, activity feed, guardrails.
- Cost inputs: confidence KPIs, sources, per-unit table with ± COGS steppers that
  recompute margins live across the whole app.
- Alerts, Plans & billing, product drawer, onboarding overlay, toasts.
- Single source of truth: `src/lib/data.js` (seed) + `src/lib/compute.js` (formula,
  mirrors BUILD_SPEC §2). State/derived values in `src/hooks/useWaterline.js`.

### ✅ Done — Backend skeleton (BUILD_SPEC build order step 1+)
- `server/db.js` — in-memory store shaped like the spec data model + append-only
  action log (prior→new for revert).
- `server/engine.js` — margin rollups, product detail, Autopilot view, cost-input
  confidence, mutations; **server-side guardrail enforcement** (e.g. plays over
  the $5,000 auto-approval limit are routed to needs-approval, not executed).
- `server/server.js` — Express REST routes; all reads accept `?range=30d|90d|12mo`.
- `src/lib/api.js` — frontend client; UI uses live backend when `VITE_API_BASE`
  is set, else falls back to local compute (so the prototype runs standalone).
- Reuses the SAME compute.js + data.js as the frontend → numbers never drift.
- Verified end-to-end via curl: totals match the UI, range scaling, guardrail
  routing, COGS override recompute, action log.

### ✅ Done — Real Shopify ingestion (`server/shopify.js`)
Pulls real catalog + COGS + orders from the Admin GraphQL API and maps them into
the margin model. Captured snapshot of the live store **Mamacita & Crew** (29
products, AUD) in `server/shopify-snapshot.json`; `WATERLINE_DATA=shopify` serves
it. Verified: order #1001 (Signature Sweatshirt) → real 49.3% margin.

### ✅ Done — Frontend on real data (data-source switch)
Topbar toggle **Sample ⇄ Mamacita & Crew** recomputes the whole dashboard from the
real snapshot (AUD currency, store name, real COGS, real margins), reusing the same
compute pipeline. `src/lib/shopifyData.js` imports the snapshot.

### ✅ Done — Ad attribution engine (`server/attribution.js`, BUILD_SPEC §4)
Maps ad spend → products via feed / UTM / order-level fallback, with confidence
degradation + per-product ROAS + unattributed tracking. `server/connectors/ads.js`
is the Meta/Google interface (stubbed — no creds here). 12 passing tests
(`node server/attribution.test.mjs`). Engine injects attributed spend before margin
compute when `db.adSpend` is populated. Verified: a $30 feed ad drops the sample
sale 49.3% → 24.1% (ROAS 3.97).

### ✅ Done — ROAS in the UI
Triage table ROAS column + drawer Ad-ROAS tile (color-coded, break-even ~1.8×).
Sample store has ROAS; real store shows "—" until ad data flows.

### ✅ Done — Autopilot execution + Guarded mode (build order §5–6 complete)
Plays run through typed executors (`server/executors.js`, the §6 action→API map)
that capture the prior value for revert and write the action log; enabling opens a
live Impact Ledger entry (before→after). **Guarded mode** auto-runs within-guardrail
plays (over-$5k → needs approval); **Ask** drafts each for one-tap approval. The
mode toggle is functional in both frontend and backend.

### 🔜 Not done — the remaining real integrations (per BUILD_SPEC §10)
1. **Shopify OAuth + ingestion** (orders, products, COGS, returns) — replace seed data.
2. Persistent DB + materialized `margins` table.
3. **Ad attribution** (Meta, then Google) — §4; makes margins "true".
4. **Alert rule engine + delivery** (in-app, email, Slack) — §8.
5. **Autopilot executors** — the real API calls that pause ads / cap discounts /
   update PDPs, with revert + the Impact Ledger writing realized before→after.
6. **Guarded mode** auto-execution (only after attribution + cost confidence solid).
7. **Billing** (Lookout / Operator / Autopilot+ with the 12% value-based fee).

## How to run
```bash
cd waterline && npm install
npm run dev                                      # UI on :5174 (local mock data)
npm run server                                   # API on :8787
VITE_API_BASE=http://localhost:8787 npm run dev  # UI against live backend
npm run build                                     # production build
```

## Important constraint: pushing to GitHub
The Claude-on-the-web session is **read-only to GitHub** — every write (push,
create-branch, merge) returns 403, by design. So Claude CANNOT push/merge.
The human pushes from **GitHub Desktop** (their machine has write access):
- Frontend is already on the `add-waterline` branch → PR #1 in `becurieux/curieux`.
- The backend commit was delivered as a ZIP (`waterline-with-backend.zip`) to be
  added via GitHub Desktop. **Confirm the backend (`server/` + `src/lib/api.js`)
  is actually on GitHub** — if a session ended before that, re-deliver it from the
  local commit `725dbcf`.
- A new repo `becurieux/claude` was created but is NOT in this session's scope
  (403). To use it, scope a session to it (still read-only for pushing).

## Local commits in this session (not guaranteed pushed)
- `64f7a62` — frontend prototype
- `725dbcf` — backend skeleton
Branch: `claude/new-session-e7p1kz`. (Note: web-session commits show as
"Unverified" — re-committing from GitHub Desktop signs them.)

## Suggested next step
Pick up at BUILD_SPEC §10 step 1: real Shopify OAuth + ingestion, wiring the
backend store to live Admin API data behind the existing route surface. The
guardrail + action-log machinery is already built to receive it.
