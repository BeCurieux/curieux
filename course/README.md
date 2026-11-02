# Her Little Empire — course platform

The Product Check, Module 0, the full course and the founding cohort:
lessons gated by tier, twelve calculators, the Product Verdict, Stripe
checkout and an admin page. Built step by step from [`SPEC.md`](SPEC.md).

Next.js (App Router, TypeScript) · Supabase (Postgres, Auth, Storage, row
level security) · Tailwind · Playwright · Vercel. Stripe and Resend arrive in
steps 5 and 7.

## Build progress

The build order is at the end of `SPEC.md`: one step per session, reviewed
before the next.

| Step | What                                                                                                       | State             |
| ---- | ---------------------------------------------------------------------------------------------------------- | ----------------- |
| 1    | Foundation: magic-link auth, `/login`, protected `/learn`, profiles trigger, admins, Playwright smoke test | Done (2026-11-02) |
| 2    | Schema: every table in Data model, RLS, entitlement resolution, products seed                              | Done (2026-11-02) |
| 3    | Content pipeline and lesson pages                                                                          | Next              |
| 4    | Calculators and `/verdict`                                                                                 |                   |
| 5    | Commerce: Stripe Checkout, webhook, refunds                                                                |                   |
| 6    | Public pages                                                                                               |                   |
| 7    | Email: Resend, sequences, daily cron                                                                       |                   |
| 8    | Admin                                                                                                      |                   |
| 9    | Launch check                                                                                               |                   |

**Step 1 notes for later steps**

- `profiles` and `admins` exist (migration `20261103000001_foundation.sql`).
  Step 2 adds the other tables and must not recreate these two. Use
  `public.is_admin()` in every "admins read everything" policy.
- Country is set once, at first sign-in, from Vercel's `x-vercel-ip-country`
  header (`/auth/confirm`). Checkout (step 5) reads it to pick AUD or USD.
- `serviceClient()` (`src/lib/supabase/server.ts`) bypasses RLS: the webhook
  and admin actions only.
- Empire Studio, next door, takes payment through Gumroad; this app uses
  Stripe as the spec says. Nothing is shared between the two apps yet,
  including their Supabase projects.

**Step 2 notes for later steps** (details: [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md))

- **Founder to decide: USD prices.** The spec gives AUD only, so
  `products.price_usd_cents` is null. Step 5 must refuse USD for a product
  without one, not invent a price.
- Entitlements: `my_tier()`, `can_access(tier)` and `my_benchmark_pack()`
  for the signed-in person; `tier_of(user)` and `has_benchmark_pack_of(user)`
  for the server. Course and founding include the benchmark pack, so the
  webhook doesn't grant a separate pack row with them.
- Lessons: name the columns you select (`select *` is refused). The video
  and script come from `lesson_content(lesson_id)`, which checks the tier;
  `lesson_assets.storage_path` is server-only (step 3's signed route).
- Spec's `order` column is `position`. Added: `lessons.slug`,
  `lessons.example`, `modules.hidden`, `calc_runs.currency`,
  `orders.refunded_at`.
- Orders, entitlements, leads, email_events and the verdict review are
  written only by the server. Users write lesson_progress, calc_runs and
  verdicts (module0+; sending for review is founding only).
- `calc_runs.calculator_slug` references `calculators`, so step 4 seeds the
  calculator rows before anything can be saved.

## Run it locally

Needs Node 22 and Docker (for the local Supabase stack).

```sh
npm install
npm run db:start          # local Supabase on ports 545xx; applies the migrations
cp .env.example .env.local  # then paste the keys `db:start` printed
npm run dev               # http://localhost:3300
```

Sign in at `/login`. The email doesn't leave your machine: open Mailpit at
http://127.0.0.1:54524 and tap the link. To make yourself an admin, sign in
once, then `npm run admin:add -- you@example.com`.

`npm run db:reset` wipes the local database and reapplies the migrations.

## Checks

| Command                                                     | What it runs                                                                                                                                                                  |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test:unit`                                         | Unit tests (Vitest)                                                                                                                                                           |
| `npm run test:rls`                                          | Row level security on Postgres with a stub auth schema. `RLS_DATABASE_URL` picks the server; the local stack works: `postgresql://postgres:postgres@127.0.0.1:54522/postgres` |
| `npm run test:e2e`                                          | Playwright at 390 px and desktop against the local stack, including the magic-link sign-in smoke test and an axe check                                                        |
| `npm run lint`, `npm run typecheck`, `npm run format:check` | Static checks                                                                                                                                                                 |

CI runs all of them (`.github/workflows/course.yml`), with a real Supabase
stack on the runner.

## Deploy

Not deployed yet. When it is:

1. **Supabase:** a new project (Sydney, `ap-southeast-2`, to sit beside
   Vercel's `syd1`). Apply `supabase/migrations/*.sql` in order
   (`npx supabase db push` or the SQL editor). Then the Auth settings in
   [`docs/AUTH.md`](docs/AUTH.md) — the email template change is required,
   not optional.
2. **Vercel:** new project from this repo, **Root Directory `course`** (see
   `../DEPLOYS.md`). Environment variables from `.env.example`.
3. **Admin:** sign in once on the live site, then add yourself (SQL in
   `scripts/add-admin.ts`).

Keys go in `.env.local` and Vercel, never in the repository.
