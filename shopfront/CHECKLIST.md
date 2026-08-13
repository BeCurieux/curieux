# POPUUP — Build Brief & Quality Checklist

Recorded 2026-08-13, as given.

**Where this sits.** `BRIEF.md` is the founding brief — why the product exists,
who it is for, what the kill test is. `CLAUDE.md` is the short contract that
must never be violated. `STANDARD.md` is the commercial bar. This is the
**quality checklist**: what "built well" means, task by task. It does not
replace any of them, and where it disagrees with `CLAUDE.md` that file still
wins — the disagreements are listed at the end.

Two things in it are time-critical rather than aspirational, both in §3's
provenance line: the model and prompt version behind every generation. They are
cheap to capture now and **unrecoverable** once the first real catalogues have
run. See "What is missing and cannot be added later".

---

Audience: Claude Code. Read this before writing or changing anything. Product: "Make a shop in a sentence." Connect a Shopify catalogue once → describe who the shop is for → a live, synced, audience-specific mini-shop exists. First wedge: the bio shop. North star: There is no page builder. The prompt is the builder. Definition of "best": Nobody turns a catalogue into a converting, audience-specific shop faster or smarter. Every task below serves that loop. If a task doesn't, question it.

Stack: Next.js (App Router) · TypeScript strict · Supabase (Postgres + Auth + RLS) · Stripe (billing only — NOT checkout) · Anthropic API behind a model-agnostic adapter · Playwright for E2E.

## 0. Non-negotiable guardrails

- Never build: visual/block builder, A/B testing, affiliate management, CRM, email platform. If a task drifts toward these, stop and flag it instead of building it.
- Checkout is Shopify's. One tap → pre-filled Shopify checkout via cart permalink. We never take payment for merchant goods, never proxy checkout, never touch PCI scope. Stripe is for POPUUP subscriptions only.
- Model-agnostic by construction. All LLM calls go through one internal adapter interface (prompt in, typed result out). No provider SDK imports outside the adapter. Model + prompt version recorded on every generation.
- Editing is words, not widgets. Post-generation changes happen through a constrained set of named moves (see §4). Never add a drag/drop, layout, or style-picker UI as a "temporary" workaround.
- Mobile-first is literal. Shops are designed at 390px and adapted up. Every shop-facing PR includes a mobile screenshot.

## 1. The first three minutes (the product IS this loop)

Target: connect → sentence → published, good-looking shop with the merchant's real data, zero required decisions, no empty states.

- Shopify OAuth connect with minimal scopes; clear error states for declined/partial permission.
- Catalogue import streams progressively — user sees products landing, never a spinner wall. Import of a 500-SKU store completes < 60s; UI is usable during import.
- Single prompt input ("who is this shop for?") with 3 rotating example prompts drawn from the merchant's own catalogue vocabulary (post-Genome).
- First shop renders < 15s after prompt submit; skeleton → progressive hydration, never a blank wait.
- Zero mandatory configuration between prompt and published URL. Sensible defaults for everything (name, slug, theme, hero).
- No empty states anywhere in the happy path: if a section would be empty (no reviews, no discount), it doesn't render — it never renders as a placeholder.
- Instrumentation (day one, not later):
  - `time_to_published_shop` (connect → live URL), per session.
  - `shared_within_10m` (link copied/opened from a non-owner device or share action fired).
  - Funnel events: shop view → product click → checkout start, attributable per shop.

Done means: a cold merchant with a messy store gets a shop they'd genuinely share, in under 3 minutes, without making a single decision.

## 2. Catalogue Genome (the quality ceiling — spend disproportionate effort here)

Real catalogues are dirty: vague titles, missing tags, no descriptions, inconsistent photos. Generation quality is capped by ingest quality. Enrichment happens at import, is stored, and is versioned.

- Enrichment pipeline at ingest produces, per product: inferred category, audience fit signals, use-case tags, price band, gift/occasion signals, hero-worthiness score, and a normalised one-line description — even when source fields are empty or junk ("Glow Drops 30ml" → niacinamide serum, oily skin, under $30).
- Enrichment output is typed, stored in Supabase, versioned (`genome_version` per product), and re-runnable without re-import.
- Confidence scores on inferred fields; low-confidence inferences are usable but flagged internally, never invented as certainty in shop copy.
- Image analysis: dominant colour, background type, crop safety box — feeding §6 auto-treatment.
- Incremental re-enrichment on product webhook updates (changed products only).
- Genome quality eval: fixture set of ≥ 10 real, messy catalogues with hand-labelled expected inferences; enrichment accuracy scored on every pipeline change. Regressions block merge.

Done means: the AI can answer "what is this product, who is it for, what does it pair with" for ugly real-world data, not demo data.

## 3. Merchandising engine + the coherence eval (the "20 shops" claim)

"One catalogue → 20 different shops" only lands if the shops are defensibly different: different selection, different lead product, different copy register — and each internally coherent for its stated audience.

- Generation consumes Genome data (not raw Shopify fields) for selection, ordering, collection grouping, hero choice, and copy.
- Selection excludes out-of-stock as hero/lead; respects prompt constraints (price ceilings, occasion, audience) as hard filters, not suggestions.
- Copy register adapts to audience (TikTok teen ≠ Father's Day gift buyer) while staying claim-safe: no invented product claims beyond Genome-supported facts.
- Merchandising eval harness (this is the test suite for the core product):
  - Matrix: ≥ 10 real catalogues × ≥ 8 audience prompts, run headlessly.
  - Scored (LLM-judge + spot human review) on: selection accuracy vs prompt, internal coherence, differentiation between prompts on the same catalogue, and "would this audience buy" plausibility.
  - Runs in CI on any change to prompts, models, or the adapter. Score drops block merge.
  - Same harness runs against ≥ 2 different model providers to prove the adapter and measure model sensitivity.
- Decision provenance logged from the very first generated shop: for every generation — inputs (prompt, genome version, model, prompt version), and the why of each decision (selection reasons, ordering rationale, hero rationale) — stored durably and joinable to funnel events. This dataset is the moat; it is unrecoverable if not captured now. PULSE itself stays unbuilt.

Done means: the 20-shops demo is reproducible on any real catalogue, and we can prove — with logged evidence — why each shop looks the way it does.

## 4. Word-editing: a closed set of moves that never fails

A constrained vocabulary where every supported move works 100% of the time beats open-ended editing that works 70%. The first weird edit result makes users ask for a block builder, which kills the thesis.

- Define an explicit, enumerated move set (v1 suggestion): reorder/feature a product, hide/show a product or collection, change tone/mood of copy, retheme (from a fixed palette set), rename shop/sections, toggle sections (reviews, email capture, discount), change hero.
- Every user utterance is classified → mapped to a move + parameters, or gracefully refused with "here's what I can do" listing the supported moves. No best-effort freeform mutations of the shop structure.
- Moves are deterministic state transitions on a typed shop model — the LLM chooses the move; code executes it. The LLM never emits raw layout/HTML.
- Every move is idempotent, previewable, and undoable (edit history on the shop model).
- Playwright suite: every supported move × 3 phrasing variants, asserted against the rendered shop. Any supported move failing any phrasing blocks release.
- Refusal copy is warm and lists capabilities — a refusal should feel like discovering features, not hitting a wall.

Done means: published moves succeed 100% of the time; everything else is refused clearly. No silent 70%-right edits, ever.

## 5. Sync trust (binary: right or dead)

One stale price or one oversold item and the merchant never trusts the surface again.

- Webhook-driven sync for products, variants, prices, inventory, images; reconciliation sweep as backstop (catches missed webhooks) with alerting on drift.
- Out-of-stock handling is immediate: item visibly unavailable or removed per shop rules — never buyable.
- Visible trust signal on every shop: "live · synced Xm ago."
- Cart permalink checkout hardened against the ugly cases: multi-variant carts, quantity edits, discount code application/stacking rules, currency/market settings, and stores with checkout-rewriting apps. Each has an explicit test.
- Failure honesty: if sync is degraded, the shop says so (or hides pricing-sensitive elements) rather than showing possibly-stale prices.
- E2E test: price change in Shopify → reflected on the live shop < 60s; inventory zero → unbuyable < 60s.

Done means: we can put "always right" in marketing copy and survive an audit of it.

## 6. Unglamorous extremes (where "best" is actually judged)

- 4-product store produces a shop that feels intentional, not sparse (layout adapts; no padded grids).
- 10,000-SKU store: import, enrichment, and generation stay within performance budgets (define and enforce: import < 10 min, generation < 30s at this scale).
- Terrible photography: automatic crop, background treatment, and consistent card presentation from §2 image analysis — quiet fixes, no user-facing "your photos are bad."
- Mixed/no images, all-sale catalogues, single-collection stores, non-English catalogues: each has a fixture store in the eval set and a defined acceptable output.
- Every fixture store above is a Playwright visual regression target.

Done means: the weird catalogues — the ones real merchants actually have — produce shops as good as the demo store does.

## 7. Public benchmark loop (the accountability mechanism)

- Internal benchmark harness: same catalogue rendered as (a) POPUUP shop, (b) Linktree Shopify Store, (c) merchant's own homepage — captured side-by-side, mobile viewport.
- Run weekly on a rotating set of real catalogues; output a comparison sheet.
- Blind preference test protocol documented (which would you tap/buy from) for use with real creators; results logged over time.
- When POPUUP wins, the artefact is marketing-ready; when it loses, the loss is a filed issue with a screenshot, triaged before new feature work.

Done means: "best available" is a measured claim with a weekly evidence trail, not a belief.

## 8. V1 scope fence

In: Shopify connect · catalogue import · Genome enrichment · prompt-generated shop · product cards · hero media · collections · reviews · discount code · email capture · constrained word-editing · creator shops (single) · custom URL · publish · mobile-first · funnel analytics (views → product clicks → checkout starts) · decision-provenance logging · free tier with badge · Pro ~$15–19/mo via Stripe.

Paid-tier later (do not build now): back-in-stock, SMS capture, deeper analytics. Fast-follow (do not build now): paste-a-TikTok-URL input. Drawer (do not build, keep feeding with logs): PULSE closed-loop merchandising. Never (see §0): visual builder, A/B testing, affiliate management, CRM, email platform.

## 9. Engineering baseline

- TypeScript strict; no `any` in the shop model, genome types, or move definitions.
- Supabase RLS on all merchant data; shops publicly readable only via published slug; provenance and analytics tables write-only from server.
- Secrets server-side only; Shopify tokens encrypted at rest; least-privilege scopes.
- Rate-limit and cost-guard all LLM calls (per-merchant budget caps; generation cost logged per shop).
- Published shops: LCP < 2.5s on mid-tier mobile, CLS < 0.1; OG/social cards correct for every shop (the link IS the product — it must unfurl beautifully).
- CI: typecheck, lint, unit, merchandising eval (§3), move suite (§4), sync E2E (§5), visual regressions (§6). Red blocks merge.

## Working rule

Before starting any task, ask: does this make it faster to get a smarter shop? If yes, build it to the standard above. If no, flag it — don't build a worse Linktree politely.

---

# Reconciliation

Recorded alongside the checklist so the disagreements are visible rather than
discovered mid-task. Nothing below has been acted on.

## What is already true, verified rather than assumed

| Line | State |
|---|---|
| §0 no provider SDK imports outside the adapter | Holds. `@anthropic-ai/sdk` is imported in exactly two files, `genome/anthropic.ts` and `merchandise/anthropic.ts`, both behind a provider interface with a deterministic twin. |
| §0 the LLM never emits markup | The architectural law in `CLAUDE.md`; every response is validated against a zod schema and retried with the error. |
| §0 mobile-first at 390px | The renderer is designed there; the browser suite asserts geometry at 390 as well as 1280 and 1440. |
| §4 moves are a typed, enumerated set | `EditMove` in `schema.ts`. Defined, unimplemented, and `tests/stop-line.test.tsx` fails if anything outside `schema.ts` uses it. |
| §5 out-of-stock is never buyable | Sold-out products render marked, not hidden, and carry no cart link. Asserted at every mood and viewport. |
| §9 TypeScript strict, no `any` in the shop model, genome types or move definitions | Holds. `strict` **and** `noUncheckedIndexedAccess`. Zero `any` in `schema.ts`, `genome/*`, or the plan types. The five `Record<string, any>` in the codebase are all row-mapping at the Supabase boundary, where the value genuinely is untyped. |
| §9 RLS; shops publicly readable only via published slug; analytics write-only from server | Proved against a real Postgres with Supabase's roles reproduced — `pnpm rls:check`, and the table in `RUNBOOK.md` §1. |
| §9 secrets server-side only | `tests/deploy-config.test.ts` fails on a `NEXT_PUBLIC_`-prefixed secret and pins the service key to two files. |
| §9 CI red blocks merge | Typecheck, unit and the browser suite run per PR. The eval, move and sync suites do not exist yet — see below. |

## What is missing and cannot be added later

**§3's provenance is incomplete in exactly the way §3 warns about.** The line
says the dataset "is unrecoverable if not captured now", and the first real
catalogues are the next thing on the runbook.

Captured today: the prompt, the stated audience, the full `ShopConfig`, and the
funnel events joined to the version that served them.

**Not captured:**

- **The model.** The adapters return it; nothing persists it. `shop_versions`
  has no column for it and `ShopConfig.meta` has no field.
- **The prompt version.** Does not exist anywhere — not a constant, not a
  column. A change to `SYSTEM_PROMPT` today is invisible to every shop
  generated before it.
- **`genome_version` per product** (§2). The Genome is stored on
  `stores.genome` with no version.
- **The *why*.** §3 asks for selection reasons, ordering rationale and hero
  rationale. The plan schema carries decisions, not reasons.

The first three are a column each and a field each. The fourth is a schema and
prompt change. All four are cheap before the four real runs and impossible
afterwards for those runs — which is the whole argument the checklist makes.

## Where it disagrees with CLAUDE.md

`CLAUDE.md` wins until somebody changes it. Each of these needs a decision.

1. **§1 is Sprint 3.** "The first three minutes" opens with Shopify OAuth, and
   builds on email capture, word-editing and billing. `CLAUDE.md` step 7 gates
   all of it on the kill test, and `tests/stop-line.test.tsx` turns CI red if
   any of it is built early. The checklist and the build order describe the
   same product in a different order; only one of them can be followed next.

2. **§5's "live · synced Xm ago" badge cannot ship yet.** `CLAUDE.md`: *"nothing
   on the page may claim sync/liveness that isn't yet wired for that store."*
   Sync needs OAuth and webhooks, which are behind the same gate. The badge is
   right the day sync is real and a lie before then.

3. **§6's 10,000-SKU target versus the Genome's 160-product ceiling.**
   `genome/prompt.ts` caps a pass at 160 products and says so in its own output
   rather than truncating silently. §6 asks for import, enrichment and
   generation inside a budget at sixty times that. Not a contradiction to
   resolve today, but the cap is a design decision that a 10k-SKU target
   retires rather than raises.

4. **§0 says "one internal adapter interface"; there are two.**
   `GenomeProvider` and `MerchandiseProvider`. Defensible — they take different
   inputs and return different types — but it is not what the line says, and
   the §3 requirement to run the eval against two providers is the thing that
   would actually prove the boundary.

5. **§2's ≥10 hand-labelled messy catalogues, §3's 10 × 8 eval matrix, §7's
   weekly benchmark.** There is one fixture store today, deliberately bad in
   seven ways. Ten real catalogues with hand-labelled expected inferences is a
   data-collection project before it is an engineering one, and the LLM-judge
   eval in CI is a per-PR model spend that needs a number attached before it is
   switched on.

6. **§9's LCP/CLS budgets and OG cards are unmeasured.** The renderer sets no
   `next/image` optimiser (deliberate — see `next.config.mjs`) and the shop page
   is `force-dynamic`. Neither budget has ever been measured on a real device,
   and `generateMetadata` exists but no test asserts a shop unfurls correctly.

## Where it strengthens CLAUDE.md rather than fighting it

- §0's *"stop and flag it instead of building it"* is the same instruction as
  the north star's *"ask before deviating"*, applied to a longer never-list.
- §3's closing line — *"PULSE itself stays unbuilt"* — matches the drawer rule
  exactly, including the part people drop: keep logging, build nothing on top.
- §4's *"the LLM chooses the move; code executes it"* is the architectural law
  restated for editing.
- The working rule at the end is a better test than any of them: *does this
  make it faster to get a smarter shop?*
