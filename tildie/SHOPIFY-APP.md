# The Shopify app

Tildie installed in a merchant's Shopify admin: every product's copy scanned,
a score per product and for the store, a badge on each product that earns one,
and a rescan whenever a product changes.

**Status (2026-09-28): stages 1–3 and 5 built and tested — the offline core,
the Next.js app, its storage in Supabase, and the storefront badge with the
App Store pack. Stage 4, first contact, waits on the owner's accounts (the
runbook below), and nothing can be submitted until it passes.** No
app exists in the Partner Dashboard and nothing here has run against Shopify.
This environment cannot reach shopify.dev or any store; the Shopify facts below
were read through the Shopify docs tool and the Admin schema, and the GraphQL
was validated against the live schema. Where a fact could not be confirmed it
says **[unverified]**.

Opened ahead of the kill test on the owner's call — see CLAUDE.md, "The thing
opened early".

---

## Decisions

**Embedded, managed install, token exchange.** The app lives inside the
Shopify admin. Shopify's own guidance for an embedded app is Shopify-managed
installation (scopes declared in `shopify.app.toml`) and token exchange (App
Bridge's ID token swapped for an access token). Shopfront's design argued this
in full and cited it; `shopfront/SHOPIFY-APP.md` §4 is the reference.

**Expiring offline tokens.** Scans run when nobody is logged in — a webhook at
3am — so the token is offline, and new installs are told to use expiring ones.
`src/shopify/token.ts` handles refresh ahead of expiry and the `needs_reauth`
state.

**`read_products` and nothing else.** Tildie reads the words on a product and
nothing about customers or orders. The three compliance webhooks are still
answered, because the App Store rejects an app that does not, and `shop/redact`
deletes everything held for the shop.

**Shopify App Pricing, not the Billing API.** This is a change from the brief
and from CLAUDE.md's stack line, both of which say "Shopify Billing". For a new
public app Shopify now defaults to App Pricing: plans live in the Partner
Dashboard, Shopify hosts the plan page, and the docs say not to call
`appSubscriptionCreate`. So the app never creates a charge. It asks which plan
a shop is on (the Partner API's `activeSubscription`) and maps the answer to
entitlements (`src/shopify/plans.ts`). A failed lookup is its own state and
never sends a paying merchant to the plan page.

**Drafts are scanned; only live products carry a badge.** Launch copy is copy
before launch (§3). A badge on a page that does not exist is meaningless.

**Every plan is rescanned on change; only Studio gets alerts.** §6 lists
"monitoring alerts" under Studio. The alert is the paid feature. The rescan is
not optional on any plan: a badge is live-linked (§5), and one that survives an
edit to the copy under it is the dishonest-badge failure the north star ranks
worst.

**The store's headline is its weakest product.** Same reasoning as the single
scan reporting its weakest market. A product with no copy is counted as
*unread*, never as clear, and never earns a badge (law 3).

---

## What is built — stage 1

All of it pure, all of it tested offline (`pnpm test`).

| File | What it does |
|---|---|
| `src/shopify/hmac.ts`, `webhook.ts`, `idempotency.ts`, `token.ts`, `admin/client.ts` | Copied from shopfront with their tests: webhook signatures, delivery headers, duplicate suppression, the token lifecycle, the Admin GraphQL client. |
| `src/shopify/idToken.ts` | Verifies App Bridge's ID token as Shopify documents for a custom backend: HS256 against the client secret, `exp`, `nbf`, `aud`, and `iss`/`dest` naming the same myshopify host. |
| `src/shopify/admin/products.ts` | Reads every product's title, description and search description, paginated, stopping at the plan's allowance and saying so. Queries validated against the live schema. |
| `src/shopify/catalogue.ts` | Runs each product through the same `scan()` and `mayDisplayBadge` as the CLI; summarises by band, unread and badges; swaps one product in or out for a webhook. |
| `src/shopify/plans.ts` | The §6 plans as entitlements, the three-state plan lookup, market selection that refuses rather than trims, the plan-page URL. |
| `src/shopify/actions.ts` | What each webhook topic makes the app do. |
| `shopify.app.toml` | The app's configuration, with placeholders for the client ID and host. |

---

## What is built — stage 2

The Next.js app, in this package. Every route is one line that calls a handler
in `src/server/handlers.ts`, and the handlers are tested end to end against a
fake Shopify that answers the token endpoint, the Admin API and the Partner
API from memory (`tests/server.test.ts`).

| Route | What it does |
|---|---|
| `/` | The page inside the Shopify admin: choose a plan, choose markets, scan, every product's score weakest first, the disclaimer. App Bridge and Polaris web components from Shopify's CDN. |
| `POST /api/shopify/session` | Verifies the ID token; on first contact exchanges it for an expiring offline token (the exact documented request, asserted in the tests); refreshes near expiry; re-acquires when the refresh token has died. Returns plan, plan page, markets and the last scan. |
| `POST /api/shopify/markets` | Saves markets within the plan; refuses a market with no pack. |
| `POST /api/shopify/scan` | Reads the store up to the plan's allowance and scans it. 402 with the plan page when there is no plan; 409 when markets need choosing again. |
| `GET /api/shopify/results` | The last scan. |
| `POST /api/shopify/webhooks` | Signature (401 if bad — the App Store check), headers, dedupe, then act. A changed product is reread and rescanned; if it cannot be reread its badge is withdrawn and marked stale before the 500 that makes Shopify retry. |

**How it runs.** `pnpm dev` with these set (`.env.local` works):

```
SHOPIFY_API_KEY=…           the app's client ID
SHOPIFY_API_SECRET=…        its client secret
SHOPIFY_API_SECRET_PREVIOUS=…   optional, during a rotation
SHOPIFY_APP_HANDLE=tildie   the handle in shopify.app.toml
SHOPIFY_PARTNER_ORG_ID=…    }
SHOPIFY_PARTNER_API_TOKEN=… } the plan lookup; without all three it answers "unknown"
SHOPIFY_APP_GID=…           }
TILDIE_DEV_PLAN=growth      development only: skip the Partner API; refused in production
SUPABASE_URL=…              }
SUPABASE_SECRET_KEY=…       } storage (stage 3); without all three, memory — refused in production
TILDIE_TOKEN_KEY=…          }
```

**Webpack, not Turbopack.** The engine imports its own files as `./x.js`, as
TypeScript's ESM resolution expects. Webpack maps that to `.ts` with one line
of config; Turbopack, Next 16's default bundler, cannot yet. So `pnpm dev` and
`pnpm build` pass `--webpack` (`next.config.mjs` says why).

**Checked in this environment:** `pnpm build` succeeds; under `pnpm dev` the
page carries the client ID and both CDN scripts, a request with no ID token
gets 401 with the retry header, a badly signed webhook gets 401, and a signed
compliance webhook gets 200. **Not checked:** anything against Shopify.

---

## What is built — stage 3

**The project.** Supabase project **Tildie Shopify app**
(`kqygkaerzyfcveblmhcw`, us-east-1, organisation Sounding Labs, free plan),
created 2026-09-28. us-east-1 because the app's server is what talks to the
database, and that sits beside Vercel's default region and popuup's project.

**The schema** is `supabase/migrations/20260928000000_shopify_app_storage.sql`,
applied to the project:

- `installations` (one row per shop, tokens sealed), `catalogues` (the last
  full scan's metadata), `product_scans` (one row per product, so a webhook
  rescanning one product never rewrites another), `webhook_deliveries` (the
  idempotency ledger).
- **Server only.** RLS on every table with no policies, and no grants to
  `anon` or `authenticated`, so the publishable key reads nothing. The app uses
  the secret key (`service_role`).
- **Every write is one database function**, so each operation is atomic: a
  webhook claim cannot race another; a full scan replaces a shop's products in
  one transaction; a product write refuses copy older than the copy it holds,
  in the database rather than in a read-then-write.

**Tokens are sealed by the app** before they are sent (`src/server/crypto.ts`,
AES-256-GCM, bound to the shop). The database never holds a usable Shopify
token, and a sealed token copied onto another shop's row does not open.

**The app's side** is `src/server/supabaseStore.ts`: one RPC call per
operation over plain fetch with the transport injected — no client library.
Summaries are recomputed on every read, never stored, so they cannot disagree
with the rows.

**Checked live, on the project** (through the Supabase tools, inside a
transaction that was rolled back — the tables are empty): installation round
trip; a product write before any scan refused; a newer product write applied
and an older one refused; stale marking drops the badge and keeps the score;
the claim ledger's five cases (first, in flight, abandoned, failed, done);
redaction removing everything; a non-myshopify domain refused; `anon` and
`authenticated` unable to select or execute; `service_role` able to. Security
advisor: only the expected "RLS on, no policies" notice.

**Checked in tests:** every handler test runs twice, on the memory store and
on the Supabase store against a fake of Supabase's RPC endpoint that keeps the
same rules; token sealing (wrong shop, wrong key, tampering, rotation); that no
request ever carries a plain token; the secret key sent as `apikey` with no
bearer token.

**Not checked:** the app talking to the real project. This environment's
network does not reach `*.supabase.co`, and the secret key is not something
these tools can read. That is the first thing stage 4 does.

**Still open in storage:** nothing calls `tildie_prune_deliveries` yet (a
daily cron once hosted); and webhooks still do their work inline (see Open
questions).

---

## Stage 4 — first contact: the runbook

Stage 4 is the first time any of this meets Shopify or the real database, and
almost all of it happens in the owner's accounts. What the repository could
prepare is prepared: `vercel.json` (build, scoping, the daily prune cron),
`pnpm check:storage`, and this list. Do the steps in order — several need a
value the step before produces. Dashboard paths are as Shopify, Supabase and
Vercel documented them in September 2026; they move things. Tick the checks as they pass and write down
anything that surprised you; every **[unverified]** above is settled here.

**Clear the name first if you can.** The code says Tildie (handle `tildie`),
but the app's name and handle are hard to change once the app exists, and the
trademark search (BRIEF.md §11 item 1b) is still the gate. If it is still out,
expect that a failed search means creating a fresh app later.

### 1. Supabase keys (10 minutes)

1. Supabase dashboard → **Tildie Shopify app** → Project Settings → API Keys →
   create a **secret key**. Copy it once, into your password manager.
2. On your own machine: `openssl rand -base64 32`. That is `TILDIE_TOKEN_KEY`.
   Store it beside the secret key. Losing it means every merchant reinstalls.
3. From `tildie/` on your machine, with the three values in `.env.local`
   (git-ignored): `pnpm install && pnpm check:storage`.
   - [ ] Every line reads `ok` and it ends *Storage works end to end.*

### 2. The Shopify app (20 minutes)

1. Create a Shopify Partner account at partners.shopify.com, if there is none.
2. Install the Shopify CLI, then from `tildie/`: `shopify app config link` →
   *create a new app*. It writes the real `client_id` into `shopify.app.toml`;
   commit that change. Copy the **client secret** from the Dev Dashboard.
3. Partner Dashboard → Stores → create a **development store**. Add four or
   five products, including at least one with loud copy ("Clinically proven to
   clear acne in 7 days", "eco-friendly packaging") and one with none.

### 3. Vercel (15 minutes)

1. New project from this repository. **Root Directory: `tildie`** — without
   it `vercel.json` is never read (DEPLOYS.md explains why that matters).
2. Environment variables (Production):

   | Variable | Value |
   |---|---|
   | `SHOPIFY_API_KEY` | the client ID from step 2 |
   | `SHOPIFY_API_SECRET` | the client secret from step 2 |
   | `SHOPIFY_APP_HANDLE` | the `handle` in `shopify.app.toml` |
   | `SUPABASE_URL` | `https://kqygkaerzyfcveblmhcw.supabase.co` |
   | `SUPABASE_SECRET_KEY` | from step 1 |
   | `TILDIE_TOKEN_KEY` | from step 1 |
   | `CRON_SECRET` | another `openssl rand -base64 32` |
   | `SHOPIFY_PARTNER_ORG_ID`, `SHOPIFY_PARTNER_API_TOKEN`, `SHOPIFY_APP_GID` | step 4 — deploy without them first |

   Not `TILDIE_DEV_PLAN`: production refuses it.
3. Deploy. Note the production URL.
   - [ ] The build succeeds (it runs `pnpm build`, which uses webpack).
   - [ ] `curl -X POST https://<url>/api/shopify/session` answers 401 with
     `x-shopify-retry-invalid-session-request: 1`.

### 4. Pricing and the plan lookup (20 minutes)

1. Partner Dashboard → the app → Distribution → choose public (App Store)
   distribution, which is where pricing lives. Nothing is listed publicly
   until you submit a listing.
2. Pricing → Settings → **Shopify App Pricing**, monthly. Create plans with
   handles `starter`, `growth`, `studio` at $49, $99, $199. Development stores
   in your organisation can pick paid plans at no charge.
3. Partner Dashboard → Settings → Partner API clients → create one with
   **Manage apps**. That token is `SHOPIFY_PARTNER_API_TOKEN`; the organisation
   ID is the number in the Partner Dashboard URL; `SHOPIFY_APP_GID` is
   `gid://shopify/App/<the app's numeric ID>`. Add all three to Vercel and
   redeploy.

### 5. Point Shopify at the deployment (5 minutes)

1. In `shopify.app.toml`, set `application_url` to the Vercel URL. Commit.
2. `shopify app deploy` — pushes the scopes, the webhook subscriptions and the
   compliance topics.

### 6. Install and walk it (30 minutes)

Dev Dashboard → the app → install on the development store. Then, in order:

- [ ] **The page renders inside the admin** with Polaris styling. If it is
  unstyled, the Polaris script path in `src/app/layout.tsx` is wrong
  ([unverified] until now).
- [ ] **A row appears in `installations`** (Supabase → Table Editor) whose
  `access_token_enc` starts `v1.` and contains no `shpat_`.
- [ ] **No plan → "Choose a plan to begin"; *See plans* opens Shopify's plan
  page** ([unverified] URL). Choose Growth.
- [ ] **Back in the app, it shows Growth** — the Partner API lookup and the
  item `handle` are what the code assumes ([unverified] until now). If it says
  it could not confirm the plan, the query or endpoint needs fixing; the app
  treats that as "unknown", never as "no plan".
- [ ] **Choose two markets; scan.** Every product listed, weakest first; the
  loud product flagged; the product with no copy reads "No copy to read" and
  carries no mark; a clean live product carries one.
- [ ] **Edit the loud product's description to something plain.** Within a few
  seconds, without pressing Scan, its row changes and it earns the mark. That is the
  `products/update` webhook, the rescan and the storage write, end to end.
- [ ] **Delete a product.** It leaves the list.
- [ ] **Compliance topics:** `shopify app webhook trigger --topic
  customers/redact --address https://<url>/api/shopify/webhooks` (and
  `customers/data_request`, `shop/redact`) — each answers 200. Shopify's own
  review check sends a bad signature and expects 401; step 3's curl already
  shows the route refuses unsigned requests.
- [ ] **Uninstall.** The `installations` row goes to `uninstalled`.
  `shop/redact` arrives about two days later and removes the row.
- [ ] **The cron.** Vercel → Settings → Cron Jobs lists `/api/cron/prune`; run
  it once by hand. It answers `{"pruned": 0}` on a new project.
- [ ] **The storefront mark** (stage 5). Online Store → Themes → Customize →
  product template → Add block → Apps → **Claims mark** → Save. The clean live
  product shows the mark; the loud one and the one with no copy show nothing
  (no broken-image icon). Switch the block to Night on a dark theme.
- [ ] **The mark follows the words.** Edit the clean product's description to
  the loud copy and save: within about a minute the mark is gone from its page.
- [ ] **Lapsed.** Cancel the plan: the mark greys and reads "Lapsed".

When every box is ticked, replace the **[unverified]** marks above with what
you saw, and stage 4 is done.

### 7. Before a real merchant installs

- Upgrade the Supabase project off the free plan (it pauses after a week idle).
- Add the app's production domain, if it will have one, and repeat step 5.

## What is built — stage 5

**The mark on the storefront.** A theme app extension,
`extensions/claims-mark/`, with one app block a merchant adds to the product
page from the theme editor — no theme code touched, as the App Store requires.
Settings: paper or night, alignment, spacing. The block is an `<img>` pointing
at `/apps/tildie/badge?product=<id>` on the shop's own domain.

**The app proxy** carries that request to the app (`[app_proxy]` in
`shopify.app.toml`; it needs the `write_app_proxy` scope, which is proxy
configuration, not data access). `src/shopify/appProxy.ts` checks Shopify's
signature; the tests reproduce **both worked examples from Shopify's own
documentation byte for byte**, so this one is verified against Shopify rather
than only against itself.

**`GET /api/proxy/badge`** decides. It serves the mark only when the request is
signed, the installation is active, and the product earned the mark
(`mayDisplayBadge`, checked again at serving time), is live, and has not
changed since it was read. Anything else is an empty image, so a page never
shows a broken icon and never shows a mark it should not. No plan on record
greys the mark to "Lapsed" (§5). The mark's date is the product's own last
reading. The SVG goes out with a `default-src 'none'` content security policy
— it is served from the merchant's origin — and a one-minute cache, so a
withdrawn mark cannot linger. Seven new behaviours, each tested on both
stores.

**In the app:** a "Show the mark on your store" section with the steps.

**The App Store pack** is APP-STORE.md: the listing (its copy scanned clean by
Tildie itself — the first draft was not), screenshots to make, the
requirements and where each is met, the reviewer's instructions, and two items
for counsel. PRIVACY.md is a draft privacy policy, written from what the code
does, for counsel.

**Not verified:** the Liquid block (no validator here; the Shopify CLI checks it
on `shopify app deploy`), and whether a merchant-renamed proxy path breaks the
block — it would stop showing rather than show something wrong.

**Deliberately absent:** the mark links nowhere, because the hosted score page
it should link to is still shut (CLAUDE.md).

---

## What only the owner can do

- Create a Shopify Partner account and the app in the Dev Dashboard; put its
  client ID in `shopify.app.toml` and its secret in the environment.
- Create a development store to install into.
- In the Partner Dashboard: switch pricing to Shopify App Pricing and create
  three plans with the handles `starter`, `growth` and `studio`, at $49, $99
  and $199 a month.
- Pick the host (Vercel, per the stack).
- Give the app its storage keys, in the host's environment, never the repo:
  the project's **secret key** (Supabase dashboard → Project Settings → API
  Keys → create a secret key), its URL `https://kqygkaerzyfcveblmhcw.supabase.co`,
  and a token key from `openssl rand -base64 32`. Losing the token key means
  every merchant reinstalls; keep it where the other secrets are kept.
- Keep the project active. Free-plan projects pause after a week without
  activity, which would take every installed shop's app down; upgrade before
  the first real merchant installs.
- Before submitting: an app icon (1200×1200), support and emergency contacts,
  a published privacy policy (PRIVACY.md, after counsel), and counsel's view
  on "Claims Verified" (APP-STORE.md).
- Clear the name before creating the app. The code now says Tildie, but the
  trademark search (BRIEF.md §11 item 1b) has not been recorded as clear, and
  App Store names are unique: the old name, Franca, was dropped because an AI
  app already had it. Listing under a name that has to change later means a
  new listing.

---

## Open questions

- **Products or SKUs.** §6 counts SKUs. A SKU is a variant and variants share
  their product's copy, so the allowance is counted in products. Confirm.
- **[unverified] The plan-page URL.** The docs index dropped the pattern;
  `planSelectionUrl` uses the one published before. Check it against the
  Partner Dashboard's own link.
- **[unverified] `activeSubscription`.** The query is the documented one, but
  the docs tool's schema predates it, so it could not be validated. Also
  unverified: that an item's `handle` is the Partner Dashboard plan handle, and
  the Partner API endpoint path. `src/server/planLookup.ts` treats anything
  unexpected as "unknown", never as "no plan".
- **[unverified] The Polaris script path** (`src/app/layout.tsx`). The docs
  index dropped the URL; the App Bridge path is confirmed.
- **Webhooks do their work inline.** A product rescan is one Admin API call and
  a scan, well inside Shopify's timeout. A bulk edit of hundreds of products is
  hundreds of deliveries; if that proves slow, stage 3 moves the work to a
  queue and answers 200 first.
- **How the badge reaches the storefront.** A theme app extension block is the
  App Store-sanctioned route and needs no script injection. Stage 5.
- **The free tier inside the app.** §4's free scan is a URL on the web. Whether
  an installed shop with no plan can see its scores before choosing one is a
  funnel decision, not a technical one.
