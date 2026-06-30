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
