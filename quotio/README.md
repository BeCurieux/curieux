# Quotio (working codename)

> Make your website do things.

A no-code builder for **beautiful interactive widgets** — calculators,
estimators and quizzes — that anyone can describe in a sentence, edit without
touching code, and embed anywhere.

The promise, in one flow:

```
describe it → customise → preview → publish → embed → measure
```

**Quotio is a development codename.** Every user-visible brand string lives in
[`src/config/brand.ts`](./src/config/brand.ts); changing it there renames the
product everywhere.

---

## Try it in two minutes

```bash
npm install
npm run dev          # http://localhost:3000
```

No accounts, no keys, no database. Then either:

- type a description into the homepage prompt box, or
- `npm run seed` for a demo account with three published widgets and a
  fortnight of traffic — sign in as `demo@quotio.test` / `demo-password`.

New to this? [SETUP.md](./SETUP.md) is the step-by-step version.

---

## Stack

- **Next.js 14** (App Router, server actions) · TypeScript · Tailwind CSS
- **Zod** — one schema, used on AI output, API bodies and database reads alike
- **Storage** — provider-agnostic (`src/lib/db/store.ts`); a JSON file store
  for zero-setup development, Supabase/Postgres for production
- **AI** — provider-agnostic (`src/lib/ai/provider.ts`); Anthropic when a key
  is present, a real local natural-language parser when it isn't
- **Stripe** — optional; the plan gates work with or without it

Three things in the suggested stack aren't here, deliberately: **dnd-kit**
(native drag plus keyboard move buttons — a drag-only list is unusable without
a mouse), **Recharts** (two hand-drawn SVG charts, a few hundred bytes instead
of ~100 kB on a page that already ships a widget runtime), and **React Hook
Form** (every form here is under five controlled fields).

---

## Architecture map

```
src/lib/widget/
  expression.ts   safe expression parser + AST evaluator — no eval, ever
  schema.ts       the widget document, in Zod
  engine.ts       visibility, rules, calculation, outcomes, breakdown
  themes.ts       6 presets → CSS custom properties
  format.ts       money/percent/duration, {{token}} interpolation
  defaults.ts     working starting points for build-from-scratch

src/lib/ai/
  provider.ts     the interface everything else depends on
  heuristic.ts    prompt → widget, locally, with a template fallback
  anthropic.ts    model-backed, with repair → regenerate → fall back
  repair.ts       makes malformed model output loadable, or refuses it
  prompts.ts      the system prompt (structured JSON, never HTML)

src/lib/db/       store.ts (interface) · local.ts (JSON) · supabase.ts
src/lib/analytics events.ts (model + roll-ups) · client.ts (batched beacons)
src/lib/plans.ts  every feature gate in the product, in one file
src/lib/templates 8 launch templates, parsed at import time

src/components/widget/    the runtime — preview, hosted page and embed alike
src/components/builder/   step list · content/design/logic tabs · publish
src/components/illustrations  36 flat vector drawings on a 48×48 grid

src/app/          marketing · builder · dashboard · /w/[slug] · /embed/[slug]
supabase/migrations/0001_init.sql
```

---

## Hard rules, enforced in code

**1. No `eval`, ever (§13).** Calculations are authored as strings and arrive
from a language model, so they are tokenised, parsed into a five-node AST and
walked by an evaluator that can only do arithmetic. There is no property
access, no member lookup and no path from an expression to a host object.
Identifiers are checked against the widget's real field ids at *compile* time,
and variable lookup is own-properties-only so `constructor` and `__proto__`
resolve to zero. See [`tests/expression.test.ts`](./tests/expression.test.ts).

**2. Malformed AI output never crashes the builder (§30).** Three lines of
defence, in order: mechanical repair (field ids, operator spellings, formula
renames), Zod, then structural pruning that *drops* references which don't
resolve rather than guessing. Anything still broken is regenerated once, then
falls back to building the widget locally, then to the nearest template.

**3. One renderer (§15).** The builder preview, the hosted page, the embed and
the marketing hero are the same component reading the same document. "What you
see is what they get" is structural, not a discipline someone maintains.

**4. Editing a live widget doesn't change it (§34).** Draft and published
schemas are separate columns. Publishing snapshots a version first.

**5. Nothing that doesn't work (§41).** Card payments say so instead of
offering a checkout that fails. A free plan's lead form is *removed* from the
document rather than hidden, so there's no button that quietly does nothing.
The result breakdown only appears when its lines reconcile with the total to
the cent — formulas that multiply two answers can't be itemised honestly, so
they aren't. There are no fabricated testimonials on the marketing site.

**6. No signup before creation (§27).** Anyone can describe, generate, edit and
preview a widget anonymously. Publishing is the one moment we ask who they are,
and the work follows them onto the account.

---

## The MVP success test (§45), as a test

> "I run a cleaning company. Make me a calculator that asks how many bedrooms
> and bathrooms the customer has and whether they want oven cleaning. Bedrooms
> cost $35, bathrooms $25 and an oven is $30."

With **no API key**, that sentence produces a three-question widget with
`bedrooms` and `bathrooms` as illustrated answer grids, `oven_cleaning` as a
toggle, and the formula
`total + bedrooms * 35 + bathrooms * 25 + oven_cleaning * 30`.

It's asserted in [`tests/generate.test.ts`](./tests/generate.test.ts), and the
whole journey — prompt → builder → publish → hosted page → embed → analytics —
is driven in a real browser by [`scripts/smoke.mjs`](./scripts/smoke.mjs).

---

## Checks

```bash
npm run typecheck
npm test              # 103 unit + integration tests

# end-to-end, in a real browser
npm run build && npx next start -p 3210
BASE=http://localhost:3210 node scripts/smoke.mjs
```

The smoke script walks §41's "must genuinely work" list — generate, edit,
reorder, add, theme, rule, preview, publish, hosted page, embed with
auto-resize, duplicate a template, record analytics — and writes screenshots
to `.smoke/`.

---

## Embedding

```html
<script src="https://your-domain/embed.js" async></script>
<div data-widget="your-widget-slug"></div>
```

The iframe posts its height to the parent as the visitor moves through the
questions, so the widget never gets its own scrollbar or leaves a gap. A plain
`<iframe>` and a hosted `/w/[slug]` page are offered too. See `/docs`.

---

## What's deliberately not here

Scorecards, pricing configurators, product finders, comparison widgets,
eligibility checkers, polls and surveys are all expressible in this schema —
`inputs → logic → calculation/scoring → result → CTA` — but §3 says don't build
them yet, so they aren't exposed. Adding one is a change to
`src/lib/widget/schema.ts` and the builder, not a migration: the widget
document is a single `jsonb` column.

Also absent on purpose: a CSS editor, a node-graph logic builder, agency
features, and enterprise analytics.
