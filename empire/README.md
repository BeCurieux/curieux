# Empire Studio

**By Her Little Empire — Big plans. Real life.**

A guided Shopify launch studio. A founder enters her business details once
and gets a coordinated, editable launch pack: Brand Blueprint, store design
brief, ten Shopify Sidekick prompts, homepage copy, product listings, photo
and mockup briefs, launch emails, a social launch kit and an adaptive launch
checklist — all versioned, copyable and exportable.

It writes only from her facts, flags what's missing instead of inventing
it, and never promises sales. Its methods come from Her Little Empire's own
products (`content/REGISTER.md`).

It also includes the **FIT Finder** — the Income Fit Test's 20-question quiz,
report, calculator and dated 14-day plan, saved to her account. It unlocks
for Income Fit Test owners (directly or in a bundle).

## Run it locally (no accounts needed)

Needs Node 22.

```sh
npm install
npm run dev
```

Open http://localhost:3000, click **Start free**, sign in with any email
(the local backend signs you straight in), and go. Data lives in
`.data/local/empire.json`. To try the paid parts, open **Account** and use
the local-only buttons to give yourself a Launch Pack or the Income Fit Test. Generation uses the free offline writer
until you set `EMPIRE_AI_PROVIDER=anthropic` and `ANTHROPIC_API_KEY` in
`.env.local` (see `.env.example`).

## Checks

| Command                                                     | What it runs                                                                                                                                                                          |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test:unit`                                         | Unit tests: generators, claims guard, billing, limits, isolation, export, security                                                                                                    |
| `npm run test:rls`                                          | Row level security on real Postgres with a stub Supabase auth schema (needs `psql` and a Postgres you can create databases on; `RLS_DATABASE_URL` overrides the default local socket) |
| `npm run test:e2e`                                          | Playwright, desktop and 390 px, incl. axe accessibility checks (local backend, offline generator)                                                                                     |
| `npm run lint`, `npm run typecheck`, `npm run format:check` | Static checks                                                                                                                                                                         |

CI runs all of these (`.github/workflows/empire.yml`).

## Deploy

1. **Supabase:** create a project, run `supabase/migrations/*.sql` in order
   (SQL editor or `supabase db push`). Auth → URL configuration: Site URL and
   redirect `https://<APP_URL>/auth/callback`. Auth → SMTP: a custom sender
   (e.g. Resend). Email sign-in on; passwords not needed.
2. **Vercel:** new project from this repo, **Root Directory `empire`**
   (see `../DEPLOYS.md`), environment variables from
   `docs/ENVIRONMENT.md` with `EMPIRE_BACKEND=supabase`.
3. **Domain:** `studio.herlittleempire.com` (`docs/INTEGRATION.md`).
4. **Gumroad:** `docs/PAYMENTS.md` → setup checklist.
5. Work through `docs/QA-REPORT.md` → "Not yet verified" before charging.

## Maintenance

- **AI spend:** `/admin` shows cost per customer; the platform pauses new
  generations at `EMPIRE_AI_DAILY_BUDGET_USD`. Model and effort are
  environment variables.
- **Prompts and methods:** `src/lib/ai/prompts.ts` (shared rules, per-module
  tasks) and `src/content/methodology.ts` (the method each module follows).
  After editing, run `npm run test:unit` and generate a few real examples.
- **Schema changes:** add a migration, update `docs/DATA_MODEL.md`, run
  `npm run test:rls`.
- **Prices and allowances:** `src/lib/billing/plans.ts` — the pricing page,
  limits and studio locks all read from it.
- **Content conversion:** `content/REGISTER.md`; rebuild the register with
  `node scripts/build-register.mjs`.
- **FIT Finder:** the opportunity data is `content/fit/opportunities.json`
  (Vee's file, verbatim). When the kit's engine changes, replace
  `tests/fixtures/fit-reference.cjs` with the shipped engine and port the change;
  the parity test tells you if they differ.
- **Refund reconciliation** runs daily via `vercel.json` cron.
- **Data requests:** customers export or delete their own data from Account.

## Docs

`docs/PLAN.md` (architecture and decisions) · `ENVIRONMENT.md` ·
`SERVICES.md` (services and costs) · `DATA_MODEL.md` · `SECURITY.md` ·
`PAYMENTS.md` · `ANALYTICS.md` · `QA-REPORT.md` · `INTEGRATION.md` ·
`MIGRATION.md` (existing customers) · `CATALOGUE.md` · `BACKLOG.md` ·
`ETSY-STUDIO.md` · `SHOPIFY-INTEGRATION.md` · `../content/REGISTER.md`
(content inventory and source-to-feature mapping).
