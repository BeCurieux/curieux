# CLAUDE.md — POPUUP

Read BRIEF.md before doing anything. This file is the short version that must never be violated.

## Brief v5 is the thesis now; the gate is re-pointed, not waived (owner's call, 2026-09-26)

`docs/HANDOFF.md` is the v5 build handoff: POPUUP becomes a Shopify app that turns a one-sentence brief into a **campaign shop** (a POP) for a founder-led **$1–20M** Shopify brand, built on a fixed, versioned taxonomy Genome. `BRIEF.md` (v3, the bio shop) stays in the repo for history and is no longer the thesis. `docs/PLAN-M0-M1.md` records every place v5 disagreed with this file and how each one was ruled on.

The rulings, which this file now enforces:

1. **The kill test is re-pointed at v5, not waived.** The mechanics are the same: 30 brands, a shop generated from each one's public catalogue data, and **proceed at 5+ of 30 actively wanting it live**. What changes is the artefact and the audience: a **campaign POP** (e.g. a Father's Day shop) sent to 30 **founder-led $1–20M brands**. Everything the gate held before, it still holds: OAuth and the embedded app (M0), billing, email capture, word-editing and TikTok input. **Open question:** the test needs a campaign POP, which needs at least the public-path half of M2 (see step 7 below).
2. **M1, the Genome v1 taxonomy, is open now.** The campaign POP the re-pointed kill test sends cannot be made without it, so it has to exist before the test can run. It runs on the credential-free public path and needs no install. What opened is listed in "The things opened early" §4.
3. **Nothing in M1 or M2 reads shopper events.** The Genome's behavioural layer (evidence states, exploration, D7) may be *stored* as `unobserved` and nothing more. Exploration gets its own ruling at M2. The drawer below is unchanged.
4. **Order access waits until M3.** `inventory_depth` compares stock to the merchant's minimum until then. `margin_band` is `unknown` wherever cost data is absent, which on the public path is everywhere.
5. **Genome classification spend is capped at A$100 for M1** and enforced by a ledger (`.cache/genome-v1/spend.json`), not remembered.
6. **Billing, when it opens, is Shopify's** (App Pricing or the Billing API; App Store requirement 1.2). Stripe is no longer in the stack for merchant billing. The stop-line check against any payment code stays until the gate opens.

## North star

**There is no page builder. The prompt is the builder.**

The user describes who a shop is for; the system selects, merchandises, designs and publishes. If a proposed feature adds blocks, sections, layout pickers, template galleries, or any builder-shaped UI: the answer is no. Ask before deviating.

Underlying direction (architecture, not launch pitch): don't tell us what page to build — tell us who is coming. This shapes what we log, never what we ship early.

## The one architectural law

**The AI fills a schema. It never writes markup.**

- Generation and editing both produce/mutate a `ShopConfig` (see `schema.ts`). Nothing else.
- The renderer is a single, hand-crafted, mobile-first template that consumes `ShopConfig`. Design quality lives in the renderer, not in model output.
- Word-editing = validated schema mutations from a constrained set of legal moves (reorder, feature/hide, resize within steps, swap imagery, retone copy, filter). Reject anything outside the set rather than guessing.
- Every model response is validated against the schema (zod). Invalid → retry with the error, never render unvalidated output.

## Stack (fixed)

Next.js (App Router) · TypeScript · Supabase · Anthropic API · Vercel · (Shopify App Pricing / Billing API once the gate opens — not Stripe, per v5). Playwright for any scraping that `/products.json` can't cover. No other services without asking.

**Asked and added: Resend, for one email, on the owner's call (2026-08-19).** `/contact` wrote a row and told nobody, which is a complete record and a useless workflow — a contact form nobody watches loses the merchants it exists to catch. It sends one plain-text message to `INBOX` when a row is written, with the merchant's own address as reply-to.

The boundary: **the row is the system of record and the email is a convenience over it.** A send that fails is logged and the request still answers 201, because by then the merchant's message is already safe and a 503 would ask them to write again for our benefit. No key configured is a normal state, not an error. Nothing else may start sending: no sequences, no marketing, nothing to a shopper — the capture gate in step 7 opened for one form and this does not widen it.

## Build order (do not reorder)

1. **Ingester** — store URL → public catalogue (`/products.json` first; fall back to scraping), brand context (name, logo, colours, voice) from the homepage. No Shopify OAuth in this phase.
2. **Catalogue Genome** — an LLM enrichment pass over the ingested catalogue, producing per-product: problem solved, likely audience, occasion, price tier, hero-vs-supporting role, complements/substitutes (by handle), photographs-well flag, giftability. Stored alongside the catalogue; input to the merchandiser. Heuristics + one model pass — no ML system, no embeddings infra unless asked.
3. **Merchandiser** — Anthropic call: catalogue + Genome + brand context + user prompt → `ShopConfig`. Selection, ordering, grouping, hero, copy, theme tokens.
4. **Renderer** — one gorgeous template consuming `ShopConfig`. This is where the taste budget goes. Must flatter mediocre product photography. Read the frontend-design skill before building it.
5. **Publish** — Supabase persistence, public URL per shop, badge on free tier, Vercel.
6. **Provenance + funnel** — every shop persists its prompt, stated audience, and the `ShopConfig` decisions; sessions record view → product click → checkout start, keyed to the shop version that served them. Checkout = Shopify cart permalink, pre-filled. Never build on-page checkout.
7. **Stop.** OAuth sync, email capture, billing, word-editing and TikTok-URL input are Sprint 3, gated on the kill-test result (5+ of 30 merchants wanting their shop live). *Since 2026-09-26 this is the v5 kill test: campaign POPs sent to founder-led $1–20M brands (see the top of this file). v5's M0, M3 and M4 sit behind it; M1 does not (§4 below). **M2 is unresolved.** Its engine (parse → hard filter → score → assemble → validate) is what makes the campaign POP the test sends, so the test cannot run without some of it. Its embedded admin UI needs OAuth and cannot come first. Which parts of M2 open before the test is the owner's call and has not been made. Until it is, M2 stays shut.*

### The things opened early

Recorded here because the alternative is a rule that quietly stopped being true. In both cases the gate was overridden, not routed around: `tests/stop-line.test.tsx` changed in the same commit that built the thing, rather than the thing being shaped to slip past it.

**1. Creator shops and shop refresh, on the owner's explicit call (2026-08-15).** The file lost its two creator checks.

**2. The Shopify app's *offline core*, on the owner's call (2026-08-17).** The check titled "has no Shopify OAuth or Admin API anywhere" was absolute and is now narrower. What opened: `src/lib/shopify/` — webhook HMAC verification, the delivery envelope, idempotency and out-of-order defence, the expiring-token lifecycle, an Admin GraphQL client behind an injected transport, and an Admin-products → `Catalogue` mapper. All pure, all tested against fakes, none of it reachable from the running app. The design is `SHOPIFY-APP.md`.

What did **not** open, and is what the narrowed checks now hold: no OAuth endpoint is called, no route wires the app in, and nothing in `lib/ingest`, `lib/genome`, `lib/merchandise`, `lib/render`, `lib/smart` or `lib/killtest` may import `lib/shopify`. Going past that — an install flow, a webhook route, persisted tokens — means opening the gate again, and the recommendation in `SHOPIFY-APP.md` §0 is not to, until the kill test has run.

**3. Email capture, on popuup's own contact form only, on the owner's call (2026-08-17).** The check titled "collects no email address" banned `<input`, `<form` and `type="email"` from every file under `src/`. It now permits them in `app/contact/` and `app/api/early-access/` and nowhere else.

What opened: `/contact`, a real form posting to a real route, writing to `public.early_access` — the only table in the schema holding personal data, service-role only, no policy, no unique constraint on email, and no consent or marketing columns. It replaces a `mailto:` link that was honest and was costing real merchants an empty draft to compose themselves. A failed write returns 503 and the form says so and shows the address to email instead; it never renders "thanks" unless a row exists.

What did **not** open, and is now its own check: **no generated shop collects anything from a shopper.** The `capture` block still renders empty, is still absent from `SPRINT_1_BLOCK_TYPES`, and nothing under `components/shop/` or `lib/render/` may grow a form. This is not a technicality. A merchant typing their own address into our form knows exactly who they are writing to; a shopper handing an address to a shop is a different person consenting to a different thing, needing a lawful basis, a double opt-in and an unsubscribe that none of this builds. A mailing list, a marketing column on that table, or capture rendered inside a shop means opening the gate again.

**4. Genome v1 (v5's M1), on the owner's call (2026-09-26).** What opened is `src/lib/genome/v1/`: a fixed, versioned taxonomy (`genome_taxonomy_v1`), a per-product classifier that picks only permitted values over five runs, deterministic price/stock/margin dimensions, merchant overrides, the Genome tables in `schema.sql`, a gold-set sampler, an eval harness, and **an internal labelling UI** at `/label` for two external merchandisers. The labelling UI is the one new form: labellers reach it by invite link, not through the repository or a login. It stores labels about products and nothing about the people labelling except the name they were invited under.

What did **not** open, and is held by `tests/stop-line.test.tsx`: nothing under `lib/genome/` reads the funnel or any shopper event; the labelling form lives under `app/label/` and `app/api/label/` and nowhere else; and v1 does not replace the Genome the merchandiser reads. The existing `CatalogueGenome` keeps feeding `lib/merchandise` until M2 compares the two on the same prompts. The model classifies from the product alone: never another merchant's data, never another product's. Pairings are merchant-declared only; a pairing the model suggests is never stored.

**The boundary that came with the second, and it is not negotiable: `pnpm ingest` stays credential-free and first-class.** Reading a public `/products.json` with no credentials is what lets a shop be built for a merchant who has agreed to nothing, which is the entire kill-test motion and the entire sales motion. The app is an **upgrade path, not a replacement**: it maps into the ingester's own output type and depends on it one way, an installation that loses its token degrades to the public feed rather than going dark, and the dependency direction is a test rather than an intention.

Everything else on the step-7 list stays shut and its checks stay in that file.

The boundary that came with the first: **a shop refreshes against the catalogue, never against what anybody clicked.** Sold out, gone, new, cheaper — those are facts about stock, they are readable in one comparison, and nothing about them is learned. The moment a refresh rule reads the funnel, it is the drawer below and it needs asking about again. This applies to the app too: it requests `read_products` and nothing else, so an order or a customer is not merely forbidden to it but invisible.

## The drawer rule

A future merchandising engine ("PULSE") may someday learn from the provenance logs. Until then it does not exist: no learned weights, no experimentation framework, no "intelligence" claims in copy, no schema built for a learning system we don't have. Log faithfully (step 6) and build nothing on top. If a task seems to require the engine, stop and ask.

This survives the exception above intact. Creator shops carry attribution, which is a fact recorded at publish time; refresh reads stock, which is a fact in the catalogue. Neither reads an outcome back into a decision, which is the thing the drawer holds.

## Product rules

- Mobile-first always; desktop is the adaptation.
- Sold-out products are shown (marked), never hidden — back-in-stock capture is a paid feature later, but the visual state exists now.
- Prices, availability and imagery come from ingested data only. Never invent products, prices, reviews or review counts. Genome fields are inferences and stay internal — never rendered as claims on the page. If reviews aren't ingestable for a store, omit the reviews block entirely.
- Every generated shop must be honest: nothing on the page may claim sync/liveness that isn't yet wired for that store.
- Copy tone: confident, minimal, editorial. No exclamation-mark ecommerce voice unless the brand's own voice is that.

## Definition of done for Sprint 1–2

`pnpm generate <store-url> "<prompt>"` produces a published, shareable, mobile-beautiful shop URL for a real store in under 60 seconds, with Genome stored and provenance + funnel events recording. Test against at least 4 real catalogues, including one with poor photography.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
