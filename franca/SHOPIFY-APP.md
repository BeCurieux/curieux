# The Shopify app

Franca installed in a merchant's Shopify admin: every product's copy scanned,
a score per product and for the store, a badge on each product that earns one,
and a rescan whenever a product changes.

**Status (2026-09-28): stages 1 and 2 of 5 built and tested — the offline core,
and the Next.js app around it.** No
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

**`read_products` and nothing else.** Franca reads the words on a product and
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
SHOPIFY_APP_HANDLE=franca   the handle in shopify.app.toml
SHOPIFY_PARTNER_ORG_ID=…    }
SHOPIFY_PARTNER_API_TOKEN=… } the plan lookup; without all three it answers "unknown"
SHOPIFY_APP_GID=…           }
FRANCA_DEV_PLAN=growth      development only: skip the Partner API; refused in production
```

**It refuses to run in production**, on purpose: storage is in memory until
stage 3, so a deployed app would forget every merchant between requests.

**Webpack, not Turbopack.** The engine imports its own files as `./x.js`, as
TypeScript's ESM resolution expects. Webpack maps that to `.ts` with one line
of config; Turbopack, Next 16's default bundler, cannot yet. So `pnpm dev` and
`pnpm build` pass `--webpack` (`next.config.mjs` says why).

**Checked in this environment:** `pnpm build` succeeds; under `pnpm dev` the
page carries the client ID and both CDN scripts, a request with no ID token
gets 401 with the retry header, a badly signed webhook gets 401, and a signed
compliance webhook gets 200. **Not checked:** anything against Shopify.

---

## Stages still to build

3. **Storage.** Supabase: installations (encrypted tokens, scopes, state),
   the delivery ledger, per-product scans, the shop's chosen markets. Row-level
   security with no anon access to tokens. Shopfront §3 has the table shapes
   to start from.
4. **First contact.** The owner creates the app and a development store; the
   CLI runs `shopify app dev`; install, scan, edit a product, watch the rescan.
   This is where every **[unverified]** gets checked.
5. **The badge on the storefront, and review.** A theme app extension that
   renders each product's mark, then App Store submission.

---

## What only the owner can do

- Create a Shopify Partner account and the app in the Dev Dashboard; put its
  client ID in `shopify.app.toml` and its secret in the environment.
- Create a development store to install into.
- In the Partner Dashboard: switch pricing to Shopify App Pricing and create
  three plans with the handles `starter`, `growth` and `studio`, at $49, $99
  and $199 a month.
- Pick the host (Vercel, per the stack) and the Supabase project.
- Settle the name first. App Store names are unique, and an AI app called
  Franca already exists (BRIEF.md §11 items 1 and 1b). Listing under a name
  that has to change later means a new listing.

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
