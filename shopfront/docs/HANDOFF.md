# POPUUP — Build Handoff for Claude Code

> **Status in this repo (added on commit, 2026-09-26):** received, **not yet adopted**.
> Several decisions below contradict `CLAUDE.md` and the checks in
> `tests/stop-line.test.tsx`. Until the owner rules on them, `CLAUDE.md` still
> wins. The reconciliation and the decisions needed are in
> [`PLAN-M0-M1.md`](./PLAN-M0-M1.md). The text below is the handoff exactly as it arrived.

> **How to use this file:** put it in the repo root (or `docs/`) and reference it from `CLAUDE.md`. Start Claude Code in plan mode and ask it to produce an implementation plan for Milestone 0–1 from this file before writing code. Full context lives in two companion docs (export them as markdown into `docs/` if you want them in the repo): *POPUUP — Product Brief v5* and *POPUUP — Genome v1 Specification*. Where this file and those docs conflict, this file wins for build decisions.

---

## 1. What we're building

POPUUP is a Shopify app that turns a one-sentence merchant brief into a live, self-maintaining shop built from the merchant's own catalogue.

> "Make a Father's Day shop for dads who boat. Under $120."

The unit of the product is the **POP**: an audience + objective + commercial rules, attached to a live catalogue. A page builder makes a page; a POP is a standing merchandising instruction that keeps itself true.

- **First buyer:** founder / ecommerce manager at a $1–20M Shopify brand.
- **Wedge:** campaign shops (Mother's Day, Father's Day, drops, gift edits).
- **Core differentiator:** the **Catalogue Genome** — a fixed, versioned merchandising ontology that classifies what each product is *for* (occasion, gift role, use context…), so "dads who boat" produces an intelligent selection, not a keyword-filtered collection.
- **Internal north star:** a sceptical merchant must never be able to say "that's a collection with a nicer header."

No drag-and-drop builder. Merchants create, lock, remove, regenerate, set rules, pause. Edits are made in words.

---

## 2. Stack

Next.js (App Router) · TypeScript · Supabase (Postgres, auth for internal tools, storage) · Anthropic API · Playwright (e2e) · Shopify Admin GraphQL + Storefront API + App Proxy + webhooks.

**Billing:** apps distributed through the Shopify App Store must charge merchants via the **Shopify Billing API**, not Stripe. Stripe only if we ever sell off-platform.

---

## 3. Build decisions (defaults — flagged for Lo to confirm)

| # | Decision | Default for V1 | Why |
|---|---|---|---|
| D1 | Where POPs render | **Shopify App Proxy** (`{store}/apps/pop/{slug}`) returning `application/liquid` so the page renders inside the merchant's theme layout. A standalone Next.js route renders the same POP for admin preview. | On-domain: keeps theme scripts (pixels), analytics, cart and trust intact. Verify the Liquid-response approach in M3 spike before committing. |
| D2 | Add to cart / checkout | App Proxy mode: Shopify Ajax Cart API (`/cart/add.js`, `/cart/update.js`) and native checkout. Preview/standalone mode: Storefront API `cartCreate` → `checkoutUrl`. | Native cart = no session loss. |
| D3 | Attribution | Set cart attribute `pop_id` and `pop_version_id` on add-to-cart; read `note_attributes` from `orders/create` webhook. | Deterministic order attribution without guessing. |
| D4 | RULES price caps | **Per item** unless the brief says basket/total. | Open question in the brief; per-item is the common merchant meaning. |
| D5 | AI | Anthropic API with **tool use / JSON schema with enums** for every classification and parse. Message Batches API for bulk catalogue ingest. | Classification against permitted values only (Genome rule 2). |
| D6 | Genome confidence | 5 classification runs per product at ingest (batch); confidence = agreement ratio. | Measured, not self-reported (Genome rule 4). Revisit cost after M1. |
| D7 | Exploration | Configurable per merchant; proposed default: 1 non-hero slot per POP in 10 renders goes to an under-observed eligible product; always flagged in decision log. | Spec requires reserved exposure; rate is policy, not ontology. |
| D8 | Multi-tenancy | Every table keyed by `merchant_id`; Supabase RLS on anything readable from client; server-side service role for jobs. | |

---

## 4. Architecture

```
Shopify ──OAuth/webhooks──▶ Ingest service ──▶ products, variants, inventory
                                  │
                                  ▼
                      Genome service (classify + derive)
                   ├─ model-classified global dims (Anthropic)
                   ├─ deterministic dims (price_band, price_position,
                   │   inventory_depth, margin_band)
                   └─ merchant-declared overrides
                                  │
Merchant admin (embedded app) ──▶ POP engine
  "Father's Day shop…"             1. parse sentence → structured brief
                                   2. hard filters (rules, stock, availability)
                                   3. score candidates against Genome
                                   4. LLM assembles (hero, order, bundles, copy)
                                      — may only choose from candidate set
                                   5. validate against RULES (hard check)
                                   6. log decisions → publish POP version
                                  │
                                  ▼
                   Renderer (App Proxy Liquid / preview route)
                                  │
         events (views, impressions w/ position, clicks, ATC, checkout)
         orders/create webhook (pop_id attribute)
                                  │
                                  ▼
                   Analytics + maintenance jobs
          (replace unavailable items per original brief; re-derive Genome
           when inputs change; per-POP funnel metrics)
```

---

## 5. Data model (Supabase / Postgres)

Suggested tables — Claude Code should refine types, indexes and RLS.

- `merchants` — shop domain, access token (encrypted), currency, plan, settings (exploration rate, inventory thresholds, margin bands).
- `products`, `variants` — Shopify IDs, title, description, product_type, tags, options, images, price, compare_at, cost_per_item, inventory, status, `inputs_hash`.
- `taxonomy_versions` — `genome_taxonomy_v1`, status.
- `taxonomy_values` — (version, dimension, value_id, layer, label, definition). Seed from §6.
- `price_band_references` — (version, parent_category, currency, budget_max, mid_max, premium_max). Hand-seeded for V1.
- `genome_values` — **one row per value** (see §6.2 record).
- `pops` — merchant_id, slug, status (draft/live/paused/ended), `brief` JSON (who/why/goal/rules + original sentence), locked product IDs, excluded product IDs, created/ended.
- `pop_versions` — immutable snapshot of each published selection: ordered items, hero, bundles, copy, taxonomy_version.
- `pop_decisions` — per item per version: product_id, position, role (hero/supporting/add_on), reason, Genome concepts matched, `is_exploration`, `decision_source` (engine / merchant_lock / maintenance_replacement).
- `events` — pop_id, pop_version_id, session_id, type (view, impression, click, add_to_cart, checkout_start), product_id, position, ts. **Impressions with position are required** — they are the exposure data the Genome's behavioural layer depends on later.
- `attributed_orders` — order_id, pop_id, pop_version_id, revenue, line items.
- `gold_labels`, `eval_runs` — human labelling and model evaluation (§8).

---

## 6. Catalogue Genome v1 (build-critical summary)

### 6.1 Rules (all dimensions)

1. **Fixed, versioned taxonomy.** Stable value IDs (e.g. `gift_role:practical`); never renamed in place; changes ship as a new version; outcome data keeps its version.
2. **Classification, not description.** Model chooses only from permitted values; `unknown` always allowed; forcing a value on thin evidence is an error. Natural-language explanations are generated *from* classifications.
3. **Provenance on every value:** `taxonomy_model` · `deterministic_rule` · `merchant_declared` · `behaviour_inferred` · `human_reviewed`. Merchant declarations override other sources for that merchant.
4. **Measured confidence** only (repeat-run agreement, logprobs where available, calibration vs gold set). Never store self-reported model scores.
5. **Comparison-set provenance** for catalogue-relative values: store scope, N, percentile, raw value. Fallback: product type in store → whole store → global category reference; minimum N = 10.
6. **Exposure-adjusted behavioural evidence.** Never infer roles from raw sales. Record what POPUUP chose to show separately from what happened after.
7. **Evidence states** for behavioural values: `unobserved` → `provisional` → `evidenced`. Reserve controlled exposure for under-observed products (D7).
8. **Human agreement gates the ontology** (§8).

The model never sees other merchants' data when classifying.

### 6.2 Value record (`genome_values`)

`product_id, merchant_id, dimension, value, layer (global|merchant_relative), taxonomy_version, provenance, confidence, evidence_state, raw_value, comparison_scope, comparison_n, percentile, derived_at, inputs_hash`. Multi-label dimensions = one row per value.

**Cross-merchant eligibility** (store as a computed flag): dimension passed agreement gate AND (human_reviewed | merchant_declared | deterministic_rule | confidence ≥ threshold) AND behavioural values are `evidenced` AND relative values met min N. `margin_band` is never eligible.

### 6.3 Dimensions

| Dimension | Layer | Values (+ `unknown`) | Labels | Derivation |
|---|---|---|---|---|
| `occasion_fit` | Global | everyday, mothers_day, fathers_day, christmas_holiday, valentines, birthday, summer_travel | Multi | Model |
| `gift_role` | Global | practical, indulgent, novelty, not_giftable | Single | Model |
| `use_context` | Global | home, outdoor, water_coastal, travel, work, social_evening, fitness, personal_care | Multi (max 3) | Model |
| `seasonality` | Global | warm_weather, cold_weather, all_season | Single | Model |
| `audience_fit` | Global | women, men, unisex_adult, kids, baby, household | Multi | Model + catalogue data (never from colour) |
| `item_type` | Global | core_item, accessory, consumable, set_bundle | Single | Model + rules (Shopify bundles → set_bundle) |
| `style_register` | Global | casual, elevated_casual, formal, playful, functional | Single | Model — **provisional**, excluded from cross-merchant learning until it passes the gate |
| `price_band` | Global | budget, mid, premium, luxury | Single | Deterministic vs `price_band_references` (default variant, pre-discount) |
| `price_position` | Merchant-rel. | entry (bottom 25%), mid (middle 50%), premium (top 25%) | Single | Deterministic percentile with §6.1 rule 5 fallback |
| `assortment_role` | Merchant-rel. | hero, supporting, add_on, neutral | Single | Cold start: merchant-declared + rules (accessory + entry → provisional add_on; merchant-featured → provisional hero; else neutral). Behavioural later. Raw sales never set it. |
| `inventory_depth` | Merchant-rel. | low (<14 days cover or below merchant min), normal, high (>90 days) | Single | Deterministic; days of cover = available ÷ trailing-28-day avg daily units. No history → units vs min only. |
| `margin_band` | Merchant-rel. | low (<40%), mid (40–60%), high (>60%) | Single | Deterministic from Shopify cost per item; `unknown` if missing, never model-estimated |
| `known_pairings` | Merchant-rel. | product IDs | Multi | Merchant-declared; behavioural later (co-ATC given co-exposure). Model suggestions shown to merchant, not stored until confirmed. |

Key boundary rules for the classifier prompt (full list in the spec): seasonal copy alone doesn't make an occasion fit; colour never implies audience or use context; pick the *dominant* gift reason, `unknown` if genuinely split; occasion timing and hemisphere live in POP context, not the label.

**Worked example — navy linen shirt, $89 AUD:** occasion_fit {fathers_day, summer_travel}; gift_role practical; use_context {water_coastal, travel, outdoor}; seasonality warm_weather; audience_fit men; item_type core_item; style_register elevated_casual; price_band mid; price_position mid (category, n=47, p52); assortment_role supporting (merchant_declared); inventory_depth normal (31 units, 42 days); known_pairings canvas cap.

---

## 7. POP engine (V1)

1. **Parse** the sentence into a structured brief with Claude (JSON schema): `who` (audience_fit + free-text persona), `why` (occasion_fit + campaign), `goal` (conversion | aov | launch | move_stock), `rules` (price_max per item, min_units, include_ids, exclude_ids, ship_by, margin_min), plus target Genome concepts. Show the parsed brief to the merchant as editable chips before generating.
2. **Hard filter:** active, available, published, passes every rule. Rules are never delegated to the LLM.
3. **Score** candidates on Genome concept match (weighted by confidence), goal (e.g. `move_stock` boosts inventory_depth high; `aov` boosts pairings/add-ons), and merchant locks.
4. **Assemble** with Claude from the top-N candidates only: hero, order, bundles, section headings, campaign copy. Output must reference candidate IDs only.
5. **Validate** the assembled POP against rules again in code; reject/repair on any violation.
6. **Log** every decision to `pop_decisions`; publish an immutable `pop_version`.

**Maintenance job** (webhooks `products/update`, `inventory_levels/update`, `products/delete` + a scheduled sweep): if a POP item becomes unavailable or breaks a rule, replace it with the next-best candidate for the *original brief*, publish a new version, log `maintenance_replacement`. Genome values re-derive when `inputs_hash` changes.

---

## 8. Genome quality harness

- **Gold set:** ~200 products across ≥8 stores and ≥5 parent categories, labelled independently by two merchandisers (build a simple internal labelling UI).
- **Agreement gate (Cohen's kappa per dimension):** ≥0.6 keep · 0.4–0.6 tighten definitions + relabel · <0.4 merge/redefine/drop.
- **Model eval** on passing dimensions: accuracy vs adjudicated gold (target ≈ human-human agreement), repeat-run consistency (≥4/5), calibration by confidence bucket, unknown rate, version stability (re-run on every prompt/model/taxonomy change; no silent label shifts).
- Deterministic dimensions: unit tests, including small-catalogue fallback cases.

---

## 9. Merchant-facing V1 scope

Connect Shopify · catalogue import + Genome · describe the shop → editable parsed brief → generated POP · lock / remove / regenerate / edit in words · custom slug · discount code · email capture · publish / pause / end · mobile-first render · per-POP funnel (views → product clicks → add-to-cart → checkout starts → orders, revenue, AOV) with baseline comparison against the merchant's own collection pages where data allows · Shopify Billing tiers (Launch $49 · Growth $149 · Pro $399 · Scale $999+).

**Not in V1:** visual builder, A/B testing UI, affiliate management, CRM, email platform, Klaviyo/Meta integrations, autonomous optimisation, cross-merchant learning (data is logged for it; nothing consumes it yet).

---

## 10. Milestones

- **M0 — Scaffold:** Next.js Shopify embedded app, OAuth, session storage, Supabase schema + RLS, webhooks registered, dev store with a realistic catalogue (≥150 products, several categories).
- **M1 — Genome:** taxonomy seed, classifier (enum schema, 5-run batch), deterministic dims, merchant overrides, labelling UI, eval harness.
- **M2 — POP engine:** brief parser, filters, scoring, assembly, validation, decision log, admin UI (describe → brief chips → preview).
- **M3 — Render & checkout:** App Proxy Liquid spike first (D1), then renderer, cart attributes, event tracking with impressions/positions, orders webhook attribution.
- **M4 — Maintain, measure, bill:** maintenance jobs, per-POP analytics, Shopify Billing, App Store readiness (GDPR webhooks, uninstall cleanup).

**Demo acceptance test (Playwright + manual):** on the dev store, "Make a Father's Day shop for dads who boat. Under $120." produces a live on-domain POP where every item is ≤ $120, in stock, and a merchandiser would agree with the hero and at least 80% of the selection; checkout carries `pop_id`; marking the hero out of stock triggers a logged replacement within the maintenance window.

---

## 11. Open questions (don't block on these — use defaults above)

- Source and upkeep of `price_band` reference bands (hand-seed for V1).
- Cross-merchant eligibility confidence threshold.
- Exposure thresholds for `provisional` → `evidenced`.
- Whether `style_register` survives the agreement gate.
- Confirm D1 (App Proxy Liquid) works with target themes; fallback is a merchant subdomain.
- POPUUP is a working name.
