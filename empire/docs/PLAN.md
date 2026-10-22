# Technical plan

## What was inspected (2026-10-22)

- **The repository is a monorepo of independent products** (`mavya`,
  `qotidia`, `tildie`, `shopfront`, …), each its own Vercel project scoped
  by Root Directory (`../DEPLOYS.md`).
- **The Her Little Empire website, FIT Finder and any Gumroad integration
  are not in it.** No framework, hosting, auth or design system of
  herlittleempire.com could be inspected.
- So, per the brief's fallback, Empire Studio is a **standalone app at
  `empire/`**, with integration points documented in `INTEGRATION.md`. It
  reuses the conventions proven in the sibling apps: Next.js 16 + React 19 +
  Tailwind 4 + Zod 4 + Supabase (from `mavya`), and a provider-agnostic,
  metered AI layer with a deterministic mock (from `qotidia`).

## Architecture in one screen

```
Browser ── Next.js (Vercel) ──┬── Supabase Postgres + Auth + Storage (RLS)
                              ├── Anthropic API (server only, metered)
                              └── Gumroad API (re-verifies every purchase)
```

- `src/lib/domain` — Zod schemas: business profile, product, one output
  schema per module.
- `src/lib/data` — the storage boundary. `UserRepo` (everything a customer
  may touch, scoped to her) and `SystemRepo` (payments, usage ledger,
  analytics). Two backends: **Supabase** (production; RLS enforces
  ownership) and **local** (a JSON file; dev, tests, demos).
- `src/lib/ai` — provider interface, Anthropic provider (structured
  outputs), offline mock provider, prompts, claims guard, cost table.
- `src/lib/generation/run.ts` — the one path every generation takes:
  ownership → access/limits/budget → generate with timeout → validate →
  guard → save version → record cost.
- `src/lib/billing` — plans and entitlements, Gumroad provider behind a
  `BillingProvider` interface, idempotent purchase handling and refunds.
- `src/content` — the methodology each generator follows, and the product
  catalogue (the bridge to the existing Her Little Empire products).
- `src/app` — pages and server actions. Every mutation is a server action
  that starts from the signed-in user's scoped repo.

## Key decisions

| Decision                                               | Why                                                                                                                              |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Standalone app, subdomain `studio.herlittleempire.com` | The main site isn't available to inspect or modify; a subdomain keeps it untouched.                                              |
| Supabase Postgres + Auth (magic link) + RLS            | Matches sibling apps; passwordless; ownership enforced by the database, tested on real Postgres.                                 |
| A local backend alongside Supabase                     | Anyone can run, test and demo the whole studio with zero setup; CI needs no secrets. Refuses to run in production.               |
| One validated schema per module                        | Predictable machine-readable output, a generic editor, no giant prompt.                                                          |
| Structured outputs + Zod re-validation + claims guard  | Schema constrains shape, not truth; the guard checks claims against her facts.                                                   |
| Deterministic launch checklist (no AI)                 | Same good advice every time, zero cost, no hallucination.                                                                        |
| Versions, never overwrites                             | Edits, regenerations and restores each add a version; profile changes never silently rewrite assets.                             |
| One-time pack with a stated generation allowance       | Honest about what "one-time" buys; protects margins.                                                                             |
| Gumroad first, behind an interface                     | The business already sells there; every purchase is re-verified with Gumroad's API. Stripe can replace it later (`PAYMENTS.md`). |
| First-party analytics in Postgres                      | Measures use (copies, downloads, exports), not just generations; no business data to ad platforms.                               |
| Methodology slot per generator, marked _interim_       | The addendum requires building on existing HLE methods; the documents weren't supplied, so modules say so.                       |

## Delivery against the brief

The first vertical slice (create account → brand details → Sidekick prompt
pack → edit → copy → save) is built and covered end to end, then Product
Writer, Mockup briefs and Marketing Studio. `QA-REPORT.md` lists exactly
what is verified and what still needs a real-world run before charging.
