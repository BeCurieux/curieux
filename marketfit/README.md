# MarketFit

Cross-border readiness for Shopify supplement merchants: per SKU and per
market (EU, UK, US), what a label or listing appears to be missing, the rule
that says so, its citation, and the fix. See `BUILD_BRIEF.md` for the product
and `CLAUDE.md` for the rules that must never be broken.

**Status: Milestone M1 is built and tested offline.** Nothing has run against
a real Shopify store or a real Supabase project yet — neither exists.

```
pnpm install
pnpm test            # 200 tests; no network, no keys
pnpm coverage        # …with the ≥90% engine coverage bar
pnpm rules           # validate rules/**/*.yaml and summarise
pnpm rules:sql       # regenerate supabase/seed.sql from the YAML
pnpm db:check        # migration + seed + RLS on a throwaway local Postgres
pnpm dev             # the embedded app (needs .env.local, see .env.example)
```

## What M1 contains

| Path | What it is |
|---|---|
| `src/engine/` | The rules engine. `assess(productFacts, market, snapshot, { asOf })` → findings + a headline score. Pure, deterministic, all seven rule kinds. |
| `src/rules/` | The YAML loader (every problem reported at once, with its file) and the SQL seed generator. |
| `rules/{eu,uk,us}/supplements/` | 37 seed rules (14 EU, 12 UK, 11 US), all `drafted` — see "The seed rules" below. |
| `supabase/migrations/` | The §4 schema, RLS, and the server's atomic write functions. |
| `supabase/seed.sql` | Generated from the YAML. Do not edit. |
| `supabase/tests/` | RLS and server-function checks run by `pnpm db:check`. |
| `src/shopify/` | ID-token verification, token exchange/refresh, webhook HMAC + envelope + idempotency, Admin GraphQL client — copied from `tildie/` with their tests. Plus the catalogue query (validated against the Admin schema). |
| `src/catalogue/` | Deterministic supplement detection, with a reason for every product. |
| `src/server/` | Session (install by token exchange), sync, webhooks; memory and Supabase stores. |
| `src/app/` | The embedded page: catalogue count, detected supplements and why. |
| `shopify.app.toml` | Scopes (`read_products` only), webhooks incl. the three compliance topics. Placeholders for client ID and host. |

### The engine in one paragraph

Rules are selected by market, category and whether they are in force on
`asOf`. Each produces a finding — `pass`, `fail` (with the rule's fix) or
`not_assessed` — carrying the rule id, version, citation and the evidence it
looked at. The headline is **blocked** if a scored `blocked` rule failed,
**needs attention** if a scored `needs_attention` rule failed, **not assessed**
if nothing scored or a scored rule could not be checked, and **ready**
otherwise. "Scored" means `verified` and not advisory. Every assessment records
the snapshot version (a hash of the rules' content).

### The seed rules

They exist to exercise every rule kind and to give the founder a template, not
to be relied on. Their citations were written from memory during the build and
**not checked against the source instruments**, which is why every one is
`drafted` (one, the German vitamin D recommendation, is `needs_review` — it is
a national recommendation, not EU law, and its URL is the BfR homepage rather
than the document). Until somebody reads each article and sets
`confidence: verified`, every product scores `not_assessed`. That is the
engine working, not failing.

`tests/rules.test.ts` promotes them all to verified in memory and checks that
a fully labelled EU, UK and US product passes every one and a bare product
does not — so a typo in a mandatory statement fails CI rather than every
merchant's product.

## Decisions — agreed 2026-10-09

Each of these departed from the original brief; the owner agreed all of them
on 2026-10-09 and BUILD_BRIEF.md now says the same. The reasoning is kept here.

1. **A fourth score, `not_assessed`.** §5 lists three. §2.1 ("if a rule isn't
   in the database, the product says not assessed") and §9 ("no score without
   verified rules") cannot both hold with three: a market with no verified
   rules would otherwise score `ready`. The `assessments.score` check
   constraint includes it.

2. **No `@shopify/shopify-api` or App Bridge React.** §3 asks for them "to
   match existing studio apps", but the existing studio Next.js app
   (`tildie/`) uses hand-written, tested modules: ID-token verification, token
   exchange for expiring offline tokens, webhook HMAC, idempotency, an Admin
   GraphQL client. M1 copies those (with their tests) and loads App Bridge and
   Polaris web components from Shopify's CDN, as tildie does. One way of
   doing Shopify auth across the studio beat two.

3. **"OAuth" is Shopify-managed install + token exchange.** Shopify's current
   guidance for embedded apps; there is no redirect-based OAuth route. The
   first authenticated request from the embedded page *is* the install.

4. **Billing: Shopify App Pricing, not the Billing API.** §3 and §7.6 say Shopify Billing
   API. When tildie built its app (2026-09-28), Shopify's docs said new public
   apps default to **Shopify App Pricing** (plans in the Partner Dashboard,
   Shopify-hosted plan page, and an instruction not to call
   `appSubscriptionCreate`). M3 builds on App Pricing, after re-reading
   Shopify's current docs to confirm it is still the rule.

5. **Columns added to §4**, each for a reason given at the top of the
   migration: `rules.title`, `rules.fix`, `rules.applies_if` (the US iron
   warning only binds iron products), `rules.retired_at`, `findings.scored`,
   `merchants.install_state`/`token_meta`/`uninstalled_at`,
   `products.category_reason`/`shopify_updated_at`/`synced_at`,
   `product_facts.confirmed`, and a `webhook_deliveries` ledger.

6. **How merchants get RLS.** Policies key on a `merchant_id` claim in the
   JWT (`public.current_merchant_id()`). The app server today uses the secret
   key for everything; the policies make it safe for the server to mint a
   per-merchant token later (e.g. for the M2 fact-confirmation UI) without
   any other change. The one merchant write allowed is confirming or editing
   a fact on their own product, and an edited value becomes `merchant_input`.

7. **Supplement detection is heuristic only.** §7.1 also mentions model
   classification; that arrives with the extraction pipeline in M2 and will
   only ever *suggest*.

8. **Webhooks include `products/create` and `products/delete`** besides the
   two §3 names, so the synced catalogue stays complete; and the three
   mandatory compliance topics.

9. **Lives in the studio monorepo as `marketfit/`**, not a fresh repo, like
   the other products here; `vercel.json` carries the per-directory ignore
   command from DEPLOYS.md.

10. **MarketFit and Tildie stay separate.** `tildie/` also scans product
    copy against cited, versioned rule packs and counts supplement brands
    among its buyers (tildie/BRIEF.md §7b). The owner chose to keep the two
    products separate; they share no code beyond the copied Shopify modules.

## What only the owner can do

1. Create the app in the Partner Dashboard; put the client ID in
   `shopify.app.toml` and `SHOPIFY_API_KEY`.
2. Create a Supabase project; apply `supabase/migrations/*.sql`, then
   `supabase/seed.sql`; create a secret key; generate `MARKETFIT_TOKEN_KEY`.
3. A Vercel project with Root Directory `marketfit` (DEPLOYS.md).
4. Read each seed rule's article, fix what is wrong, and set
   `confidence: verified` on the ones that hold — or replace them with the
   real rule sets (§8, founder-owned).
