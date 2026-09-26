# Plan: Milestones 0–1 from the handoff, set against the repo as it stands

Written 2026-09-26 in answer to [`HANDOFF.md`](./HANDOFF.md). **No code has been
written against it yet.** The handoff asks for a plan before code, and this repo
has a written rule that matters here: *"Ask before deviating"* (`CLAUDE.md`). A
lot of the handoff deviates, so this plan comes in three parts:

1. **What the handoff changes**: every conflict with `CLAUDE.md`, `BRIEF.md`,
   `SHOPIFY-APP.md` and the checks in `tests/stop-line.test.tsx`, each one needing a ruling.
2. **What already exists** and carries over.
3. **The M0 and M1 plans**, written so M1 can start before any of the rulings in part 1.

---

## 1. Where the handoff and the repo disagree

POPUUP already exists in this repo as `shopfront/` (the `popuup` Vercel
project). Sprints 1–2 are complete. Step 7 of the build order is **"Stop"**, gated
on the kill test (5+ of 30 merchants wanting their shop live). The candidate
lists are committed (`killtest/candidates*.txt`), but the repo records no result.
So as far as the repo knows, **the gate is still closed.**

The handoff is effectively *Brief v5*: a new buyer, a new wedge and a new
architecture. The table below lists each conflict. The "Enforced by" column
names the check that fails if code lands without a ruling.

| # | Topic | Repo today | Handoff | Enforced by | Recommendation |
|---|---|---|---|---|---|
| C1 | **Gate** | OAuth, billing, email capture and word-editing wait for the kill test | M0 starts with OAuth and an embedded app | `stop-line.test.tsx` "builds no Shopify OAuth endpoint call…" | **Owner's call.** Either the kill test is waived (and the waiver is written into `CLAUDE.md`, as the three earlier openings were) or M1 goes first on the public path (§3). |
| C2 | **Wedge and buyer** | Bio shop; any Shopify merchant; Free / Pro ~$15–19 | Campaign shops; $1–20M brands; $49–$999+ | `BRIEF.md`, pricing page, `tests/pricing.test.tsx` | Adopt v5 as the brief if the owner confirms. Keep v3 in git history rather than editing it in place. |
| C3 | **App as front door** | The public `/products.json` path stays first-class. Installing is the *conversion*, not the entry (`SHOPIFY-APP.md` §0) | OAuth-first | `stop-line` "keeps the credential-free ingester independent" | Keep the public path anyway. It is how a gold set spanning ≥8 stores gets built without eight installs (§8 of the handoff), and it costs nothing to keep. |
| C4 | **Billing** | Stripe (in the stack line), though no billing is built | Shopify Billing | `stop-line` "takes no payment…" | **The handoff is right.** Verified: App Store requirement 1.2.1 says apps *"must use Shopify App Pricing or the Shopify Billing API"*. One refinement: *new* public apps default to **Shopify App Pricing**, where plans are configured in the Partner Dashboard and no billing code is written ([billing](https://shopify.dev/docs/apps/launch/billing)). Prefer that for the four fixed tiers. |
| C5 | **Rendering and checkout** | popuup-hosted `/{slug}`, cart permalink | App Proxy on the merchant's domain, Ajax cart, native checkout | `CLAUDE.md` step 6, "never build on-page checkout" | Compatible in spirit: Ajax cart plus Shopify checkout is still Shopify's checkout. This is M3, not M0–1. Keep the hosted route as the preview renderer, as D1 already says. |
| C6 | **Genome shape** | One pass over the whole catalogue with free-text fields (`problemSolved`, `audience`, `occasions`); `complements`/`substitutes` stored from the model; `priceTier` computed per store | Fixed enum taxonomy, one row per value, provenance, confidence from 5 runs; model-suggested pairings **not stored** until the merchant confirms | `tests/genome*.test.ts` | Adopt the taxonomy. Keep the current Genome running beside it until the merchandiser has moved over (§3, M1.9). |
| C7 | **The drawer** | No learned weights, experiments or scoring. Refresh never reads the funnel | D7 exploration slot; behavioural evidence states; confidence-weighted scoring; a cross-merchant eligibility flag | `stop-line` "has no learned weights, experiments or scoring" (bans `experiment`, `bandit`, `weights = {…}`) | **The biggest conflict.** Exploration uses exposure data to change what is shown, so it *is* an experiment. Hand-set scoring weights (M2) are arguably fine. Propose: M1 stores `evidence_state` (always `unobserved`) and `provenance`, and builds **nothing** that reads events. D7 waits for its own ruling at M2. |
| C8 | **Product storage** | `stores.catalogue` JSON blob. §3.1 argues *against* a normalised product cache | `products`, `variants` tables | none | `genome_values` needs a per-product foreign key, and `inputs_hash` needs a per-product row, so the handoff's need is real. Add a thin `products` table (id, store, GID/handle, `inputs_hash`) keyed off the existing catalogue, not a full mirror. `SHOPIFY-APP.md` §3.1 gets amended in the same commit. |
| C9 | **Scopes** | `read_products` only; `read_orders` refused deliberately (protected customer data, and it is an outcome) | `inventory_depth` needs trailing 28-day units sold (orders); `margin_band` needs unit cost; attribution needs `orders/create` | `SHOPIFY-APP.md` §6 | M0 asks for `read_products` plus whatever unit cost needs. `unitCost` sits on `InventoryItem`, which probably means `read_inventory` (still to confirm in M0). Push `read_orders` to M3/M4 and give it its own review. Until then, `inventory_depth` falls back to "units vs min", which the handoff already allows. |
| C10 | **Email capture** | Banned inside any generated shop | In V1 scope | `stop-line` "renders no capture block…" | Out of M0–1. Needs a ruling before M3. |
| C11 | **Editing in words** | Moves defined, none applied | V1 | `stop-line` "defines the word-editing moves and applies none" | Out of M0–1. Needs a ruling before M2. |
| C12 | **Multi-tenancy** | Keyed by `store`; no merchant login | `merchant_id` everywhere; RLS | none | Add `merchants` (the installation) → `stores`. Keep `shopify_installations` from `SHOPIFY-APP.md` §3.2 as the table behind it rather than inventing a second one. |

**The one decision that unblocks everything:** does Brief v5 replace v3, and is
the kill-test gate waived? If yes, the first commit of M0 rewrites `CLAUDE.md`
and the affected `stop-line` checks *in the same commit as the code*. That is how
the three earlier openings were done, and the rule is recorded in `CLAUDE.md`.

---

## 2. What already exists and carries over

| Handoff need | Already in the repo |
|---|---|
| Webhook HMAC, delivery envelope, idempotency, out-of-order defence | `src/lib/shopify/{hmac,webhook,idempotency}.ts`, tested |
| Expiring offline token lifecycle, token exchange design | `src/lib/shopify/token.ts`, `SHOPIFY-APP.md` §4 (managed install + token exchange, verified) |
| Admin GraphQL client, Admin products → catalogue mapper | `src/lib/shopify/admin/{client,catalogue}.ts` |
| Installation, delivery-ledger and sync-state tables | Designed in `SHOPIFY-APP.md` §3.2 and ready to apply |
| "LLM may only choose from candidates" and "validate in code" | `lib/merchandise/validate.ts` and the plan-schema loop: zod, then retry with the error |
| Immutable versions, provenance (model, prompt version, genome version) | `shop_versions` ≈ `pop_versions` |
| Maintenance / replacement against the original brief | `lib/smart/{drift,repair,decide}.ts`, which reads stock and never the funnel |
| Funnel events keyed to version | `shop_events` (view, product_click, checkout_start). Still needs `impression` + `position`, and `add_to_cart` |
| Provider pattern: mock + Anthropic, deterministic offline | `lib/genome/provider.ts`, `mock.ts`, `anthropic.ts` |
| Price tier computed, never asked of the model | `lib/genome/heuristics.ts`, which is essentially `price_position` |

About 40% of M0 is Stage 1–3 of `SHOPIFY-APP.md` §9, already designed. It should
be built to that design rather than redesigned.

---

## 3. The plan

### Ordering: M1 before M0

The handoff orders M0 before M1. **Most of M1 needs no installation.** The
taxonomy, classifier, deterministic price dimensions, labelling UI and eval
harness all run on public catalogues. So does the gold set (≥8 stores, ≥5
categories), which is *easier* to assemble from public feeds than from eight dev
installs. Only `margin_band` and `inventory_depth` need Admin data, and both
already have an honest `unknown` / fallback.

So the proposal: **start M1 now on the public path.** It needs no gate ruling
except C6 and C8, which are internal. **Run M0 in parallel once C1 is decided.**
This also means the most important risk in the whole handoff, whether humans
agree on the ontology (kappa ≥ 0.6), gets measured before anything is built on it.

---

### M1 — Genome v1 taxonomy

Everything lives under `src/lib/genome/` next to the current Genome, versioned
as `genome_taxonomy_v1`. Nothing under `lib/ingest` changes.

**M1.1 Taxonomy as code, seeded to the database**
- `src/lib/genome/taxonomy/v1.ts` holds the dimensions, values, layer,
  cardinality (single / multi / multi-max-3), labels, definitions and
  boundary rules from handoff §6.3. It is `as const`, and every value ID is
  `dimension:value`. `unknown` is added to every dimension by construction,
  not by hand.
- The code is the source of truth. The `taxonomy_versions` and
  `taxonomy_values` rows are *generated from it* by `pnpm supabase:setup`.
- A test fails if an existing value ID in a released version is renamed or
  removed (rule 1). A taxonomy change means `v2.ts`.

**M1.2 Schema** (appended to `src/lib/publish/schema.sql`, following the repo's
re-runnable, additive convention rather than adding a migration tool)
- `taxonomy_versions`, `taxonomy_values`, `price_band_references`
  (hand-seeded: version, parent category, currency, three maxima).
- `products` (thin; see C8): `id`, `store_id`, `handle`, `shopify_gid` (nullable
  on the public path), `inputs_hash`, `updated_at`; unique `(store_id, handle)`.
- `genome_values`: the §6.2 record exactly, plus `run_agreement` (for example
  `4/5`) and `model` / `prompt_version`. There is one row per value. The
  primary key is `(product_id, dimension, value, taxonomy_version,
  provenance)`, and precedence is resolved at read time
  (`merchant_declared` > `human_reviewed` > `deterministic_rule` >
  `taxonomy_model`).
- `genome_overrides` is not a separate table: an override is a
  `genome_values` row with `provenance = 'merchant_declared'`.
- `cross_merchant_eligible` is a **view**, not a stored flag, so it can never
  go stale against the gate results. `margin_band` is hard-excluded.
- `gold_labels` (product, labeller, dimension, value, taxonomy_version) and
  `eval_runs` (config fingerprint, metrics JSON).
- RLS: every new table is enabled with **no policy** (service role only), the
  same stance as `stores`. `rls-check.sql` is extended to prove anon can read
  none of them.

**M1.3 `inputs_hash`**
- A stable hash of exactly the fields the classifier sees: title, type, tags,
  options, description text, image count, vendor. The deterministic dimensions
  hash their own inputs separately (price, stock, cost), so a price change does
  not trigger a 5× model reclassification.

**M1.4 Classifier (model dimensions)**
- One request per product. The model sees only that product and no other
  merchant's data (rule "model never sees other merchants'"). This is a
  deliberate change from the current whole-catalogue pass, which exists to
  build the relationship graph. Pairings now come from the merchant (C6), so
  that reason no longer applies.
- Structured output with **enums generated from `taxonomy/v1.ts`**, so the
  schema and the taxonomy cannot drift. Multi-label dimensions are arrays with
  `maxItems`. No free-text confidence field exists anywhere in the schema
  (rule 4).
- The prompt carries the definitions and the boundary rules (colour never
  implies audience; seasonal copy is not an occasion; dominant gift reason
  else `unknown`). `prompt_version` is a content fingerprint, as the
  merchandiser's already is.
- **5 runs per product.** Confidence = the modal value's share (for
  multi-label, per value: how many of 5 runs included it; a value is kept if
  it appears in ≥3). Runs that tie → `unknown`.
- Bulk ingest goes through the **Message Batches API**. Interactive
  single-product reclassification (a webhook, later) uses the normal API.
  Both run behind the existing `GenomeProvider` interface, so `mock` stays
  deterministic for tests and CI (CHECKLIST: model-agnostic adapter).
- Rule-based corrections applied after the model, provenance
  `deterministic_rule`: Shopify bundle/components → `item_type:set_bundle`.
- **Cost check before the first real run:** with 5 runs × ~150–500 products ×
  ~8 stores, write down the token estimate from one store and confirm it
  with the owner before running the gold set (D6 says "revisit cost after M1").

**M1.5 Deterministic dimensions**: pure functions, each with its own test file.
- `price_band`: default variant, pre-discount price vs `price_band_references`
  for the parent category and currency. No reference → `unknown`.
- `price_position`: percentile with the rule 5 fallback chain (product type in
  store → whole store → global reference; N ≥ 10). `comparison_scope`,
  `comparison_n`, `percentile` and `raw_value` are always written. The
  existing `heuristics.ts` tier logic is folded into this.
- `inventory_depth`: units vs merchant minimum when there is no sales history.
  That is the public path and every store until `read_orders` (C9); the
  days-of-cover formula is implemented and tested but only fed in M3+.
  On the public path, availability is often boolean-only → `unknown`, never
  guessed.
- `margin_band`: cost per item (M0 Admin data only) → else `unknown`. Never
  estimated.
- `assortment_role`: the cold-start rules only (accessory + entry → add_on,
  merchant-featured → hero, else neutral), each `provisional`. Raw sales never
  set it, and in M1 there is no sales data to read anyway.
- Tests include the small-catalogue fallbacks the handoff calls out (N < 10
  at every level).

**M1.6 Merchant overrides**
- `setOverride(product, dimension, values)` writes `merchant_declared` rows
  and wins on read. `known_pairings` is only ever written this way. Model
  pairing *suggestions* are returned to the caller and never persisted
  (handoff §6.3). No UI in M1: a CLI (`pnpm genome:override`), then the
  admin UI in M2.

**M1.7 Labelling UI (internal)**
- `/internal/label`, behind Supabase Auth with an allow-list of labeller
  emails. It is not merchant-facing and not linked from anywhere public.
- Shows one product at a time (images, title, description, price) and one
  control group per dimension, generated from `taxonomy/v1.ts`. It never
  shows the model's answer (blind labelling) or the other labeller's.
  Writes `gold_labels`.
- Plain form controls, mobile-usable. `stop-line`'s form check is widened to
  permit forms under `app/internal/`, in the same commit.

**M1.8 Gold set and eval harness**
- `pnpm genome:goldset` samples ~200 products from ≥8 public stores and ≥5
  parent categories (stratified). The store list is committed like
  `killtest/candidates.txt`.
- `pnpm genome:eval` computes, per dimension:
  - Cohen's kappa between the two labellers (multi-label: per value, then
    averaged), mapped to **keep ≥0.6 / tighten 0.4–0.6 / redefine <0.4**.
  - Model accuracy vs adjudicated gold (only on dimensions that pass).
  - Repeat-run consistency (share with ≥4/5 agreement).
  - Calibration by confidence bucket (3/5, 4/5, 5/5).
  - `unknown` rate.
  - Version stability: diff against the previous `eval_run` with the same
    taxonomy. Any label that flips without a prompt, model or taxonomy change
    is flagged.
- Output: a markdown report under `docs/eval/` plus an `eval_runs` row. The
  run is keyed by (taxonomy version, prompt fingerprint, model) so a rerun
  after any change is comparable.
- Unit tests for the kappa implementation against known textbook values.

**M1.9 Bridge to the merchandiser, without changing it yet**
- `genomeFor()` keeps returning the current `ProductGenome`, so the
  merchandiser and renderer do not move in M1. A read-side adapter exposes
  taxonomy values to the merchandiser prompt behind a flag, so M2 can compare
  both on the same prompts before switching.

**M1 exit condition:** kappa per dimension from two real labellers on ~200
products, a model eval report for the dimensions that pass, and every
deterministic dimension under test. Also `pnpm test`, `pnpm typecheck` and
`pnpm build` green, and the public path (`pnpm generate <url> "<prompt>"`)
unchanged.

---

### M0 — Embedded app scaffold (after C1 is ruled)

This is `SHOPIFY-APP.md` §9 stages 1–4, carried out as designed, plus the
handoff's additions.

**M0.1 Contract commit.** Rewrite `CLAUDE.md` (Brief v5, the gate waived,
Shopify Billing/App Pricing replacing Stripe, the drawer's new line per C7).
Narrow the `stop-line` checks it affects. This goes in the same commit as the
first route.

**M0.2 App config.** `shopify.app.toml` (Shopify CLI): managed install; scopes
`read_products` plus whatever unit cost needs (verify `read_inventory`
against `InventoryItem.unitCost` first; C9); app-specific webhook
subscriptions for `products/create|update|delete`, `inventory_levels/update`,
`app/uninstalled`, `app/scopes_update` and the three compliance topics. App
Proxy config is left for M3.

**M0.3 Embedded admin shell.** An App Bridge-hosted route in the existing
Next.js app (`src/app/app/…`) using Polaris web components. Session tokens are
verified server-side, then token exchange → expiring offline token
(`lib/shopify/token.ts`). Read the Next 16 docs in
`node_modules/next/dist/docs/` first, per `CLAUDE.md`.

**M0.4 Session and token storage.** `shopify_installations`,
`shopify_sync_state` and `shopify_webhook_deliveries` exactly as in §3.2.
Tokens are encrypted at rest per §4.4. `merchants` is a view or table over
installations carrying currency, plan and settings (exploration rate,
inventory minimum, margin bands). The exploration setting is stored but read
by nothing until C7 is ruled.

**M0.5 Backfill.** Paginated Admin `products` → `catalogue.ts` →
`stores.catalogue` with `source = 'app'`, plus `products` rows and
`inputs_hash` (M1.3), then enqueue Genome classification. The Stage 1 exit
test runs first: the app-backed and public catalogues agree for one real store.

**M0.6 Webhook route.** `/api/shopify/webhooks`: HMAC, then the ledger, then
the coalescing compare-and-set writer (§3.1). A changed `inputs_hash` →
reclassify that product. Plus the reconciliation sweep.

**M0.7 Uninstall and compliance.** Drop tokens, return the store to the public
path, and serve the compliance topics (the data held is catalogue only,
until C9 changes that).

**M0.8 Dev store.** Seed ≥150 products across several categories. The Shopify
connector in this environment can import a mock-shop catalogue and create
products, so this is scripted rather than hand-built. Include deliberately
messy listings (empty descriptions, junk titles) and some with unit cost set,
so `margin_band` gets exercised.

**M0 exit condition** (from `SHOPIFY-APP.md` §9, merged): install on the dev
store → full catalogue and Genome in the database → a product edited in admin
reclassifies within one debounce window (observed) → replaying the delivery
changes nothing (observed) → uninstalling returns the store to the public path
with shops still serving (observed by loading the page).

---

## 4. Rulings (owner, 2026-09-26)

1. **Brief v5 replaces v3 as the product thesis. The kill-test gate is not
   waived; it is re-pointed at v5.** The mechanics are unchanged: 30 brands, a
   shop generated from public catalogue data, proceed at 5+/30 wanting it live.
   The artefact becomes a campaign POP and the audience founder-led $1–20M
   brands. `CLAUDE.md` and `tests/stop-line.test.tsx` were updated for v5 with
   the gate intact. **M1 starts now.** M0 (§3) waits on the gate, so the M0.1
   "contract commit" above becomes the commit that opens the gate after the
   v5 kill test passes.
2. **M1 and M2 build nothing that reads shopper events.** Exploration (D7)
   gets its own ruling at M2. Enforced by a stop-line check on `lib/genome/`.
3. **Order access waits until M3.** `inventory_depth` compares stock to the
   merchant's minimum until then.
4. **Up to A$100 is approved for gold-set classification in M1.** The one-store
   run also reports the per-merchant cost for a 2,000-SKU catalogue at 5 runs.
   The cap is a ledger the classifier checks before it submits anything.
5. **The labellers are two external merchandisers, not the owner,** labelling
   from the spec only. The labelling UI works without repo access: invite
   links to a deployed page, blind to the model and to each other.

### Consequences for the plan above

- M1.7 uses **invite links** (a random token, stored hashed) instead of
  Supabase Auth. An external merchandiser gets a URL, not an account.
- The **gold set** needs ≥8 public stores. This build container cannot reach
  storefronts (egress is registries and the Anthropic API only; see
  `fixtures/README.md`), so `pnpm genome:goldset` runs on a machine that
  can. The one-store cost run used the committed `bench-and-bolt` fixture.
- **Resolved (owner, 2026-09-26): M2's engine is open, its admin UI is not.**
  Was: the gate and M2 depend on each other. A campaign POP needs the
  v5 engine: parsing "under $120" into a hard per-item rule, filtering in
  code, then assembling from candidates. The existing merchandiser takes a
  prompt, but it does not enforce rules outside the model. The proposal is
  to open M2's **public-path engine** (parse, filter, score, assemble,
  validate, decision log, as a CLI like `pnpm generate`) before the test, and
  keep its **embedded admin UI** behind the gate with M0. That needs a ruling.
- **The kill-test candidate lists** (`killtest/candidates*.txt`) were chosen
  for the bio-shop test. Re-screening them for founder-led $1–20M brands
  belongs with the POP engine (M2). A campaign POP to send cannot exist before
  M2 anyway.

## 5. M1: the one-store cost run (2026-09-26)

`pnpm genome:classify bench-and-bolt.myshopify.com --provider anthropic --mode batch`
ran on the committed dev-store fixture. Storefronts are unreachable from the
build container, so the fixture was the only real catalogue available. That
is 10 products × 5 runs = 50 requests, Claude Sonnet 5 at low effort, one
400px image per product, by the Batches API. It finished in 3 minutes with no
failed runs.

| | Tokens |
|---|---:|
| Input, uncached | 20,145 |
| Cache write | 153,088 |
| Cache read | 13,312 |
| Output (thinking included) | 4,979 |

**Spent: US$0.24 ≈ A$0.37**, i.e. **US$0.024 ≈ A$0.037 per product at five
runs.** The pre-flight estimate was US$0.39, pessimistic as intended. The
M1 ledger stands at A$0.38 of A$100 (the smoke test included).

**Per merchant, a 2,000-SKU catalogue at five runs:**

| Basis | USD | AUD |
|---|---:|---:|
| As measured, by batch | 47.55 | 73.70 |
| As measured, direct | 95.09 | 147.39 |
| With the prompt cache doing its job, by batch (estimated) | ~12 | ~19 |

The measured figure is the ceiling, not the expectation. The 3.3k-token
taxonomy prompt was **written to the cache 46 times and read only 4 times**,
because a batch's requests run in parallel and mostly miss each other's
writes. Cache writes cost 1.25× input and were 80% of the bill. At catalogue
scale, most requests should read the cached prompt at 0.1× input instead.
The estimated row assumes that (~3.3k cached, ~400 uncached and ~100 output
tokens per request, at batch price). Measure it on the first 2,000-SKU store
rather than trusting either row. If the cache still misses, submitting one
request ahead of the batch to warm it is the lever.

**The gold set costs little against the cap.** ~200 items × 5 runs at the
measured rate is ≈ US$4.80 ≈ A$7.40. That leaves room to re-run it after a
definition is tightened, which the gate will likely ask for at least once.

**The classifications on this catalogue** (hand tools and workwear) look
plausible, and the disagreements fall where the gate should look. The drill
was `set_bundle` 3/5 (it ships with batteries, a charger and a case, so is it
a set?). The work gloves were `accessory` 3/5. Every tool was
`fathers_day`, which is what a merchandiser would say, and exactly the
occasion-fit judgement the labellers are there to check. Nothing here is a
verdict. It is 10 products from one dev store.

## 6. M2: the engine, opened (2026-09-26)

Built as proposed: `src/lib/pop/` and `pnpm pop` (see the README). The first
real run was on the dev-store fixture, with the Genome v1 values from §5, the
brief read by Sonnet 5 and the shop assembled by Opus 5. "Make a Father's Day
shop for dads who boat. Under $120." gave:

- **Filter:** 4 of 10 products passed. 4 had no variant at or under $120 and
  2 were sold out, including the $79.99 angle grinder.
- **Published:** 3 products, all under $120 and in stock. The hero is the
  socket set (Father's Day 5/5, men 5/5, practical 5/5). The $119.99 laser
  level was shortlisted and left out by the model.
- **Nothing matched `use_context:water_coastal`.** It is a hardware store.
  The engine ranked on what did match, and did not pretend.

Two things for the owner, both in the existing merchandiser rather than new
code, and both what a sceptical merchant would catch:

1. **The copy leaned into the brief harder than the products do.** "Grip for
   wet lines" and "covers engine, trailer and deck hardware" are about boating;
   the listings are not. That is a claim about use the catalogue does not make.
   Tightening the merchandiser's copy rule to what the listing supports is the
   fix, and the demo acceptance test ("a merchandiser would agree") is where it
   would be caught.
2. **Sale items show their pre-sale price struck through.** The socket set
   reads "~~$129.99~~ $89.99" on an "under $120" page. The shopper pays $89.99,
   so the rule holds (D4 is about what the item costs), but a struck-through
   $129.99 on that page may read as a broken promise. Say which it should be.

The brief parser also offered concepts the sentence does not state
(`seasonality:warm_weather`, `style_register:functional, casual`). That is
what the confirm-and-edit step is for, but the parser's instruction can be
stricter.
