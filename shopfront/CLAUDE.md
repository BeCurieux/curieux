# CLAUDE.md — POPUUP

Read BRIEF.md before doing anything. This file is the short version that must never be violated.

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

Next.js (App Router) · TypeScript · Supabase · Stripe · Anthropic API · Vercel. Playwright for any scraping that `/products.json` can't cover. No other services without asking.

## Build order (do not reorder)

1. **Ingester** — store URL → public catalogue (`/products.json` first; fall back to scraping), brand context (name, logo, colours, voice) from the homepage. No Shopify OAuth in this phase.
2. **Catalogue Genome** — an LLM enrichment pass over the ingested catalogue, producing per-product: problem solved, likely audience, occasion, price tier, hero-vs-supporting role, complements/substitutes (by handle), photographs-well flag, giftability. Stored alongside the catalogue; input to the merchandiser. Heuristics + one model pass — no ML system, no embeddings infra unless asked.
3. **Merchandiser** — Anthropic call: catalogue + Genome + brand context + user prompt → `ShopConfig`. Selection, ordering, grouping, hero, copy, theme tokens.
4. **Renderer** — one gorgeous template consuming `ShopConfig`. This is where the taste budget goes. Must flatter mediocre product photography. Read the frontend-design skill before building it.
5. **Publish** — Supabase persistence, public URL per shop, badge on free tier, Vercel.
6. **Provenance + funnel** — every shop persists its prompt, stated audience, and the `ShopConfig` decisions; sessions record view → product click → checkout start, keyed to the shop version that served them. Checkout = Shopify cart permalink, pre-filled. Never build on-page checkout.
7. **Stop.** OAuth sync, email capture, billing, word-editing and TikTok-URL input are Sprint 3, gated on the kill-test result (5+ of 30 merchants wanting their shop live).

### The one thing opened early

**Creator shops and shop refresh, on the owner's explicit call (2026-08-15), ahead of the kill test.**

Recorded here because the alternative is a rule that quietly stopped being true. The gate was overridden, not routed around: `tests/stop-line.test.tsx` lost its two creator checks in the same commit that built the feature, rather than the feature being shaped to slip past them. Everything else on the step-7 list stays shut and its checks stay in that file.

The boundary that came with it, and it is not negotiable: **a shop refreshes against the catalogue, never against what anybody clicked.** Sold out, gone, new, cheaper — those are facts about stock, they are readable in one comparison, and nothing about them is learned. The moment a refresh rule reads the funnel, it is the drawer below and it needs asking about again.

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
