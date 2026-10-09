# Build Brief — Cross-Border Readiness for Shopify (working name: MARKETFIT)

Keep this file as the source of truth; update it as decisions change. The
decisions agreed after M1 (2026-10-09) are written into the text below and
marked *[decided 2026-10-09]*; README.md, "Decisions", has the reasoning.

## 1. What we are building

A Shopify app that tells a merchant, per SKU and per destination market,
whether a product can be sold there, what's legally missing, and generates the
compliant label text and listing copy in the required languages — then monitors
for rule changes and re-flags affected SKUs.

MVP scope (v1, ship in ~8 weeks):

* Category: dietary supplements only
* Destination markets: EU (DE + FR language packs first), UK, US
* Source: any Shopify store (catalogue is read via API; origin market is just metadata)
* One output: a Readiness Report per SKU per market, plus generated label/listing text

Everything else (cosmetics, more markets, more languages, agency/partner
portal) is v2+ and must not leak into v1.

## 2. Non-negotiable design principles

1. **Verdicts come from rules, not from an LLM.** Every "required",
   "prohibited", or "missing" finding maps to a structured rule record with a
   citation (regulation, article/section, effective date, source URL). The LLM
   is used only for (a) extracting structured product data from messy inputs
   and (b) drafting copy/translations against rules that have already been
   applied. If a rule isn't in the database, the product says "not assessed",
   never guesses.
2. **Every finding is explainable.** UI shows: what's wrong → which rule → the
   citation → the fix.
3. **Confidence is explicit.** Each rule has a `confidence` (`verified` |
   `drafted` | `needs_review`). Only `verified` rules affect the headline
   score; others show as advisories.
4. **Not legal advice.** Product copy, ToS and every report footer say so. The
   word "compliant" is never used as a verdict; we use "ready / needs attention
   / blocked".
5. **Self-serve end to end.** No step requires talking to us. Install → scan →
   report → pay → fix → re-scan.

## 3. Stack

* Next.js (App Router) + TypeScript
* Supabase (Postgres, auth, RLS, edge functions for scheduled jobs)
* Shopify: Admin GraphQL API, OAuth, app embedded via App Bridge, webhooks
  (`products/create|update|delete`, `app/uninstalled`, and the three
  compliance topics). Note: Shopify's official template is Remix; we stay on
  Next.js to match existing studio apps — and, to match them fully, use the
  studio's own tested Shopify modules (copied from `tildie/`) with App Bridge
  and Polaris web components from Shopify's CDN, not `@shopify/shopify-api` or
  App Bridge React. Install is Shopify-managed with token exchange for expiring
  offline tokens, not redirect OAuth. *[decided 2026-10-09]*
* Stripe Billing is not used for merchant billing — Shopify apps bill through
  Shopify. For a new public app that means **Shopify App Pricing** (plans in
  the Partner Dashboard, Shopify-hosted plan page; the app reads the active
  plan and never creates a charge), not the Billing API — to be re-confirmed
  against Shopify's docs when M3 starts. *[decided 2026-10-09]* Stripe only for
  the one-off Market Entry Review sold off-platform (later).
* Anthropic API for extraction and drafting (structured outputs with JSON
  schemas; temperature low).
* Playwright for end-to-end tests against a dev store.
* Deployed on Vercel; Supabase hosted.

## 4. Core data model

```
merchants          id, shop_domain, access_token (encrypted), plan, origin_market, installed_at
products           id, merchant_id, shopify_product_id, title, category, raw_json, extracted (jsonb), extracted_at
product_facts      product_id, key, value, source (shopify|label_upload|merchant_input|ai_extracted), confidence
markets            code (EU, UK, US), name, languages[], currency, active
rules              id, market_code, category, rule_key, kind (required_field|prohibited_substance|limit|warning_text|language|registration|claim), params (jsonb), severity (blocked|needs_attention|advisory), citation (jsonb: regulation, article, url, effective_from, effective_to), confidence, version, updated_at
rule_sources       id, market_code, title, url, last_checked_at, hash  -- for change monitoring
assessments        id, product_id, market_code, score (ready|needs_attention|blocked), created_at, rules_version
findings           id, assessment_id, rule_id, status (pass|fail|not_assessed), evidence (jsonb), fix_text
generated_assets   id, product_id, market_code, kind (label_text|listing_copy|warning_block), language, content, rules_version, created_at
market_entitlements merchant_id, market_code, active_until
```

RLS: merchants see only their own rows. Rules are global, read-only to merchants.
Policies key on a `merchant_id` claim in the JWT; the server uses the secret
key. The columns added to this list in M1 are listed at the top of the
migration. *[decided 2026-10-09]*

## 5. Rules engine

* Rules are data, stored in Postgres, authored via a YAML seed directory
  (`/rules/{market}/{category}/*.yaml`) that migrates into the `rules` table.
  The founder authors rules; Claude Code builds the engine and seeds examples
  only.
* Engine: pure TypeScript function `assess(productFacts, market, rulesSnapshot)
  → findings[]`. Deterministic, unit-tested, no network calls.
* Rule kinds to support in v1:
  * `required_field` (e.g. responsible person name+address, net quantity,
    batch/lot, best-before)
  * `prohibited_substance` (ingredient list vs. market banned/novel-food list)
  * `limit` (max daily dose for vitamins/minerals per market)
  * `warning_text` (mandatory statements, e.g. "do not exceed recommended dose")
  * `language` (which languages the label/listing must be in)
  * `registration` (e.g. notification requirements, EPR packaging registration
    — flagged as a to-do with link, not assessed)
  * `claim` (prohibited/restricted health claims — v1 does keyword/phrase
    matching against an authorised-claims list; semantic claim checking is v2)
* Scoring: any `blocked` fail → blocked; any `needs_attention` fail → needs
  attention; no verified rule applies, or a scored rule could not be checked →
  **not assessed**; else ready. Only `verified`, non-advisory rules score;
  advisories and registration to-dos never change the score.
  *[decided 2026-10-09]*

## 6. AI usage (narrow and schema-bound)

1. **Extraction:** from Shopify product JSON + optional uploaded label
   image/PDF → `product_facts` matching a strict JSON schema (ingredients[]
   with amounts/units, net quantity, dosage, claims[], warnings[],
   manufacturer, country of origin, languages present). Each fact tagged
   `ai_extracted` with confidence; merchant confirms before assessment runs.
2. **Drafting:** given passed/failed findings + facts + target language →
   generate label text blocks and listing copy. Prompt includes the exact
   mandatory statements from rules verbatim; the model may not alter them.
3. **Change monitoring (v1.5):** scheduled job hashes `rule_sources` pages; on
   change, creates a review task for the founder. The model summarises the
   diff; it does not update rules automatically.

Never let model output write directly to `rules`.

## 7. Merchant flow (v1)

1. Install from App Store → OAuth → we pull catalogue, detect supplement
   products (title/tags/type heuristics + model classification), show count.
2. Merchant picks a destination market (first one free to preview, locked
   results beyond 3 SKUs until paid).
3. Scan → extraction → merchant confirms facts (inline edit) → assessment runs.
4. Readiness dashboard: table of SKUs × markets, score chips, click into findings.
5. Finding view: rule, citation, evidence, one-click "generate fix" →
   generated label/listing text, copy button, optional "push to Shopify"
   (writes to metafields + translations, never overwrites the main description
   without confirmation).
6. Billing via Shopify App Pricing (§3). Plans: Starter $149/mo (1 market, ≤50
   SKUs), Growth $349/mo (3 markets, ≤250 SKUs), Scale $799/mo (all markets,
   unlimited). Annual = 10 months.
7. Weekly email digest: new findings, rules updated, SKUs that changed and need
   re-scan.

## 8. Milestones for Claude Code

* **M1 (week 1–2):** repo scaffold, Shopify OAuth + embedded app, catalogue
  sync, Supabase schema + RLS, rules YAML loader + engine with 10 seed rules
  per market, unit tests.
* **M2 (week 3–4):** extraction pipeline (text only), facts confirmation UI,
  assessment + dashboard, findings view with citations.
* **M3 (week 5–6):** drafting (label text, listing copy, DE/FR),
  push-to-Shopify metafields, Shopify App Pricing plans + entitlements gating,
  App Store listing assets.
* **M4 (week 7–8):** label image/PDF extraction, weekly digest, Playwright e2e
  on a dev store, App Store review submission checklist (GDPR webhooks, privacy
  policy, data retention).

Founder-owned in parallel: authoring the real rule sets (supplements
EU/UK/US), legal copy/ToS, App Store listing text, partner outreach.

## 9. Definition of done for v1

* A fresh dev store with 20 supplement products can install, scan for
  EU/UK/US, and see citations on every finding.
* Engine has ≥90% unit coverage; assessment of 250 SKUs × 3 markets runs < 30s.
* No finding without a citation. No score without `verified` rules.
* Shopify app review passes (webhooks, billing, privacy).

## 10. Out of scope for v1 (write down so nobody builds it)

Cosmetics or any second category; markets beyond EU/UK/US; languages beyond
EN/DE/FR; semantic claims analysis; agency/partner portal;
responsible-person/EPR fulfilment (link out only); customs/duties/tax (link to
existing apps); non-Shopify platforms.

## 11. Decided, and why it stays this way

* MarketFit and Tildie (`tildie/`) stay separate products sharing no code
  beyond the copied Shopify modules, despite both reading supplement labels
  against cited rules. *[decided 2026-10-09]*
* MarketFit lives in the studio monorepo as `marketfit/`. *[decided 2026-10-09]*
