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
| 3    | Content pipeline and lesson pages                                                                          | Done (2026-11-03) |
| 4    | Calculators and `/verdict`                                                                                 | Done (2026-11-03) |
| 5    | Commerce: Stripe Checkout, webhook, refunds                                                                | Done (2026-11-03) |
| 6    | Public pages                                                                                               | Done (2026-11-03) |
| 7    | Email: Resend, sequences, daily cron                                                                       | Done (2026-11-03) |
| 8    | Admin                                                                                                      | Next              |
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

- USD prices are set (migration `20261103000003_usd_prices.sql`): the AUD
  prices at about 0.70, rounded to whole dollars. Every product has both.
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

**Step 3 notes for later steps** (how to write lessons: [`docs/CONTENT.md`](docs/CONTENT.md))

- Lessons are markdown in `content/modules/`; `npm run content:seed` loads
  them. Only two placeholder lessons exist (0.1 and 0.2, both free, as the
  spec's free tier says). The founder's scripts replace them.
- One access rule for lessons: `can_open_lesson(lesson)` for the caller and
  `user_can_open_lesson(user, lesson)` for the server. It is the lesson's
  `min_tier`, or the benchmark pack for lessons with
  `opens_with_benchmark_pack` (the hidden Library). The lesson page,
  mark-complete and `/api/assets/[id]` all go through it.
- Downloads: private `lesson-assets` bucket, served by `/api/assets/[id]` as
  a signed URL that expires in 60 seconds.
- Videos: `BUNNY_STREAM_LIBRARY_ID`, optionally `BUNNY_STREAM_TOKEN_KEY` for
  signed embeds; YouTube needs nothing.
- Locked lessons and modules link to `/pricing`, which arrives in step 6.
- The "lesson 0.8 completed" email (step 7) can hang off `setLessonDone` in
  `src/app/learn/actions.ts`.

**Step 4 notes for later steps** (formulas and open decisions: [`docs/CALCULATORS.md`](docs/CALCULATORS.md))

- Twelve calculators in `src/lib/calc/`; `npm run content:seed` also writes
  their rows (tier, module, form schema) so RLS can check saved runs.
- `/tools`, `/tools/[slug]` (autosave via `src/app/tools/actions.ts`, which
  recomputes on the server) and `/verdict` (margin and break-even re-read
  from her latest Unit Economics run on save).
- Cash Cycle is Module 0 (the verdict reads it). The other seven are course.
- Founding members send a verdict for review from `/verdict`. The review
  (`review_md`) is written by the server; the admin page that writes it is
  step 8.
- Several one-line specs needed reading; they're listed in
  docs/CALCULATORS.md for the founder to confirm.

**Step 5 notes for later steps** (how payments work and how to set up Stripe: [`docs/PAYMENTS.md`](docs/PAYMENTS.md))

- `/checkout/[product]` takes product slugs: `module-0`, `course`,
  `founding`, `benchmark-pack`. Step 6's pricing page links there.
- `src/lib/commerce/orders.ts`: `recordCheckoutSession` (webhook and
  success page) and `refundOrder` (account page now, admin in step 8).
- Step 7 hooks the receipt, onboarding and refund-confirmation emails onto
  `recordCheckoutSession` and `refundOrder` / `recordRefund`.
- `/account` has purchases and refunds. Email preferences (step 7) and
  delete account are still to add.
- Needs `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPPORT_EMAIL`, and
  `npm run stripe:setup` once per Stripe mode.

**Step 6 notes for later steps**

- **The copy is placeholder.** Every file in `content/pages` is
  `draft: true` and shows a "Draft copy" notice. Terms and privacy are
  explicitly not legal text. The founder's copy replaces them, and step 9's
  launch check should refuse any `draft: true`. Prices in copy are
  `{{price:…}}` tokens (`content/pages/README.md`).
- "The three gates" on the home page is a placeholder heading: the spec
  names the section, not its content.
- Leads: `capture_lead` (migration 7), sources `product_check`,
  `hype_check`, `waitlist`, or `keyword` for ManyChat links
  (`utm_source=manychat`). Waitlist interests in `leads.interests`.
- Step 7: the "lead captured" email (magic link plus "start with lesson
  0.2") replaces the plain Supabase sign-in email for /check and /hype; the
  three-email nudge reads `leads`.
- Hype Check rubric and log: [`docs/HYPE_CHECK.md`](docs/HYPE_CHECK.md).
- A unit test (`tests/unit/copy.test.ts`) refuses earnings language, GST
  and typed-in prices in page copy and UI code.

**Step 7 notes for later steps** (what's sent when, and setup: [`docs/EMAIL.md`](docs/EMAIL.md))

- The email copy in `content/emails` is placeholder (`draft: true`), like
  the page copy. Step 9's launch check should refuse drafts there too.
- `sweepEmails` (`src/lib/email/sweep.ts`) runs after every purchase and
  refund (`src/lib/commerce/orders.ts`), so the admin refund in step 8 sends
  the refund confirmation without extra code.
- The admin page can read `email_events` and `email_suppressions` (admins
  read all).
- Needs `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET` and
  `EMAIL_TOKEN_SECRET`; the daily cron is in `vercel.json`.

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
