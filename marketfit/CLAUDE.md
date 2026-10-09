# CLAUDE.md — MarketFit

Read BUILD_BRIEF.md before doing anything; it is the source of truth for scope.
README.md records where the build departs from it and why. This file is the
short version that must never be violated.

## The laws

**1. No verdict exists that a rule did not produce.** Every `fail` and every
headline score comes from `assess()` in `src/engine/`, applying a rule record
with a citation. A model may extract facts (M2) and draft copy (M3); nothing it
returns reaches a finding, a score or the `rules` table. There is no path from
model output to a verdict and there must never be one.

**2. The engine is pure.** Nothing under `src/engine/` reads a file, a clock,
the network, the environment or a model; the date is an argument.
`tests/engine-purity.test.ts` enforces it.

**3. Silence is not "ready".** A market or category with no verified rules
scores `not_assessed`. An unconfirmed `ai_extracted` fact is treated as
unknown, and a rule that depends on it is `not_assessed`, never passed.
Registration rules are to-dos and never score. Only `verified`, non-advisory
rules move the headline.

**4. Never "compliant".** Scores are ready / needs attention / blocked / not
assessed. Every surface showing a result carries the not-legal-advice
disclaimer (`DISCLAIMER` in `src/server/handlers.ts`).

**5. No rule cites an instrument nobody has read.** The seed rules in `rules/`
are `drafted`: their citations were written from memory during the build and
have not been checked against the source text. Only the founder sets
`confidence: verified`, after reading the article. `tests/rules.test.ts`
fails if a seed arrives verified.

## Rules about rules

- One rule per file: `rules/{market}/{category}/{rule_key}.yaml`. Market,
  category and key come from the path.
- Rule ids (`{market}.{category}.{rule_key}`) are permanent. A rule whose
  meaning changes gets a new key; bump `version` for wording fixes.
- After editing any rule: `pnpm rules:sql`, and commit `supabase/seed.sql` with
  it. The test suite fails when they disagree.
- A rule removed from the YAML is retired in the database, never deleted —
  findings that cite it must still resolve.
- Fact keys are a closed set (`src/engine/facts.ts`). A new one is a code
  change, not a YAML change.

## Stack (fixed)

Next.js App Router (webpack, as tildie — see `next.config.mjs`), TypeScript,
zod, Supabase over PostgREST RPC with the secret key, Shopify Admin GraphQL.
The Shopify plumbing is copied from `tildie/` with its tests, not from
`@shopify/shopify-api` — see README.md, "Decisions". No other services without
asking.

## Checks

`pnpm typecheck && pnpm coverage && pnpm rules && pnpm build && pnpm db:check`
— the same as CI (`.github/workflows/marketfit.yml`).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
