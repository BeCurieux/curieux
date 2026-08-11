# CLAUDE.md — Shopfront

Read BRIEF.md before doing anything. This file is the short version that must never be violated.

## North star

**There is no page builder. The prompt is the builder.**

The user describes who a shop is for; the system selects, merchandises, designs and publishes. If a proposed feature adds blocks, sections, layout pickers, template galleries, or any builder-shaped UI: the answer is no. Ask before deviating.

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
2. **Merchandiser** — Anthropic call: catalogue + brand context + user prompt → `ShopConfig`. Selection, ordering, grouping, hero, copy, theme tokens.
3. **Renderer** — one gorgeous template consuming `ShopConfig`. This is where the taste budget goes. Must flatter mediocre product photography. Read the frontend-design skill before building it.
4. **Publish** — Supabase persistence, public URL per shop, badge on free tier, Vercel.
5. **Funnel events** — view → product click → checkout start. Checkout = Shopify cart permalink, pre-filled. Never build on-page checkout.
6. **Stop.** OAuth sync, email capture, creator shops, billing, word-editing are Sprint 3, gated on the kill-test result (5+ of 30 merchants wanting their shop live).

## Product rules

- Mobile-first always; desktop is the adaptation.
- Sold-out products are shown (marked), never hidden — back-in-stock capture is a paid feature later, but the visual state exists now.
- Prices, availability and imagery come from ingested data only. Never invent products, prices, reviews or review counts. If reviews aren't ingestable for a store, omit the reviews block entirely.
- Every generated shop must be honest: nothing on the page may claim sync/liveness that isn't yet wired for that store.
- Copy tone: confident, minimal, editorial. No exclamation-mark ecommerce voice unless the brand's own voice is that.

## Definition of done for Sprint 1–2

`pnpm generate <store-url> "<prompt>"` produces a published, shareable, mobile-beautiful shop URL for a real store in under 60 seconds, with funnel events recording. Test against at least 4 real catalogues, including one with poor photography.
