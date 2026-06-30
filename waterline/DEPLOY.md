# Deploying Waterline

Two pieces: a **static frontend** (Vite) and an optional **API** (Express). The
frontend runs fully standalone on bundled sample/snapshot data, so you can ship it
alone in minutes; add the API when you want it backed by a live server.

```
Frontend (Vercel)  ──VITE_API_BASE──▶  API (Render)  ──▶  (later) Postgres + Shopify/Meta/Google
   static, instant                      Express, optional
```

---

## Track 1 — Frontend only (fastest, no API)

The UI computes margins client-side from the bundled data, so this alone is a
working, shareable demo (Sample + the real Mamacita & Crew snapshot).

**Vercel**
1. Vercel → **Add New → Project** → import the `becurieux/curieux` repo.
2. Set **Root Directory** to `waterline`. (Vercel reads `waterline/vercel.json`.)
3. Deploy. Framework: Vite · Build: `vite build` · Output: `dist` (already configured).
4. Done — you get a `…vercel.app` URL.

> Leave `VITE_API_BASE` unset for now; the app runs on bundled data.

CLI alternative: `cd waterline && npx vercel`.

---

## Track 2 — Add the API (live backend)

**Render** (zero code change — runs `npm run server`, which reads `$PORT`):
1. Render → **New → Blueprint** → pick the repo. It reads `waterline/render.yaml`
   (service `waterline-api`, rooted at `waterline/`).
   - Or **New → Web Service** manually: Root Dir `waterline`, Build `npm install`,
     Start `npm run server`, Health check `/api/health`.
2. Env: `WATERLINE_DATA=shopify` (snapshot) or `seed` (sample).
3. Deploy → you get a `…onrender.com` URL. Verify `GET /…/api/health`.

**Point the frontend at it:**
4. In Vercel → the project → **Settings → Environment Variables** → add
   `VITE_API_BASE = https://waterline-api.onrender.com` → **Redeploy**.

Now the UI fetches from the live API. (`src/lib/api.js` switches automatically
when `VITE_API_BASE` is set; CORS is already open on the server.)

> Render's free tier sleeps on idle — first request after idle is slow. Fine for
> demos; use a paid tier or a keep-alive ping for production.

---

## Track 3 — Persistence (Postgres / Supabase)

Without a database the API keeps state in memory (resets on restart). To persist
overrides, enabled plays, the action log, and the Impact Ledger:

1. **Supabase** (you already have it) → create a project → copy the connection
   string (Project Settings → Database → Connection string / URI).
2. Create the tables once:
   `psql "$DATABASE_URL" -f waterline/server/db/schema.sql`
   (or paste `server/db/schema.sql` into the Supabase SQL editor).
3. Set `DATABASE_URL` on the API host (Render → Environment). On boot the app
   **hydrates** saved state from Postgres and **write-throughs** every mutation.

That's it — no code change. `server/db/pg.js` is a no-op when `DATABASE_URL` is
unset, so local/demo runs stay in-memory. DB errors are caught (the in-memory
store stays authoritative), so a flaky connection can't take the API down.

## Track 4 — Connect Shopify (live ingestion)

**Single store (fastest — great for a test/dev store):** create a **custom app**
in your Shopify admin (Settings → Apps → Develop apps), grant the read scopes,
install it, copy the Admin API access token → set `SHOPIFY_SHOP` +
`SHOPIFY_ADMIN_TOKEN` on the API (leave `WATERLINE_DATA` unset). On boot the API
**auto-syncs** that store; you can also re-pull anytime with
`POST /api/sync` (e.g. `curl -X POST https://<your-api>/api/sync`). No public
URL or OAuth is needed for this path — the token is static.

**Multi-merchant OAuth (a real app):**
1. **Shopify Partners** → create an app → set **App URL** `${APP_URL}/auth` and
   **Redirect URL** `${APP_URL}/auth/callback`.
2. Set `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `APP_URL` (your public API URL),
   and `SHOPIFY_SCOPES` on the API host.
3. A merchant installs by visiting `${APP_URL}/auth?shop=their-store.myshopify.com`.
   The callback verifies HMAC, exchanges the token, registers `orders`/`refunds`
   webhooks, and runs the first sync. Webhooks re-sync automatically on new orders.

Token storage + product catalog persist to Postgres (Track 3). Without
`SHOPIFY_API_KEY/SECRET` the `/auth` route returns 503 and the app stays on
seed/snapshot data — nothing else is affected.

> Autopilot *acting* on Shopify (discount caps, PDP notes, price changes) needs
> **write** scopes (`write_products`, `write_price_rules`, …) — request those only
> when you enable execution; ingestion is read-only.

## Track 5 — Embedded app + billing (hybrid Autopilot+)

Run Waterline **inside Shopify admin** and bill the hybrid plan ($299/mo +
12% of recovered margin) on the merchant's Shopify invoice.

**Embed the app (App Bridge):**
1. In **Shopify Partners → your app → Configuration**, set the **App URL** to your
   frontend (the Vercel URL) and keep **Embedded** on. Add the Vercel URL to the
   allowed redirection URLs alongside `${APP_URL}/auth/callback`.
2. Build the frontend with `VITE_SHOPIFY_API_KEY` = your app's **client id**
   (same value as `SHOPIFY_API_KEY` on the API). On Vercel → Environment Variables.
3. When Shopify opens the app it adds a `host` param; the UI then loads App Bridge
   and attaches a session token to every API call (`Authorization: Bearer …`),
   which the API verifies (`server/session.js`) to identify the shop. Standalone
   (no `host`/key) the shell is a no-op — the demo deploy is unaffected.

**Turn on billing:**
4. Billing reuses `SHOPIFY_API_KEY/SECRET` + `APP_URL`. Optionally set
   `SHOPIFY_BILLING_TEST=false` to issue real charges (defaults to test charges).
5. The merchant clicks **Upgrade to Autopilot+** → `POST /api/billing/subscribe`
   creates the subscription (recurring $299 + a usage line) and returns Shopify's
   `confirmationUrl`; the UI redirects there for approval. Shopify returns them to
   `${APP_URL}/billing/callback`.
6. The 12% is charged as **usage records** against that subscription whenever the
   Impact Ledger verifies recovered margin — `billing.recordRecoveryFee(shop,
   token, usageLineItemId, recovered)` (wire this into ledger-close once you go
   live; it's gated behind an active subscription).

Without `SHOPIFY_API_KEY/SECRET` the billing routes return 503/401 and the Plans
page falls back to an in-app toast — the standalone app still works end-to-end.

> Billing needs an installed shop (a stored offline token from Track 4) and the
> live embedded context, so it can't be exercised from the demo deploy — it's
> verified by structure and the inert no-creds path.

## Other hosts
- **Frontend** also works on Netlify / Cloudflare Pages / GitHub Pages (build
  `vite build`, publish `dist`, SPA-rewrite to `index.html`).
- **API** also works on Railway / Fly.io / any Node host (`npm run server`,
  honor `$PORT`). To keep everything on Vercel instead, wrap `server/server.js`
  in a single catch-all serverless function under `api/` — Render is simpler.

## Environment variables
See `.env.example`. None are required for the demo. For live data later:
`SHOPIFY_*`, `META_*`, `GOOGLE_*` (those phases are scaffolded but stubbed).

## Next deploy phases
- **Database**: swap the in-memory `server/db.js` for Postgres (Supabase). Schema = BUILD_SPEC §9.
- **Shopify OAuth**: per-merchant install + webhooks feeding `server/shopify.js`.
- **Ad APIs**: fill the Meta/Google connectors (`server/connectors/ads.js`).
