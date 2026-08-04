# Keeper (working brand TBD)

> You live it. We help you keep it.

Keeper turns a parent's photographs, quotes and short memories about their
child into a beautifully designed annual childhood book — starting with
**The Year You Were Two**. The family supplies the life; the software
supplies the organisation. AI curates and edits. **AI never invents a
family memory.**

## Stack

- **Next.js 14** (App Router, server actions) · TypeScript · Tailwind CSS
- **Supabase** — Postgres (RLS on every user table), Auth, private Storage
- **Stripe** — one-off payments (digital creation → physical upgrade)
- **AI** — provider-agnostic adapter (`src/lib/ai/provider.ts`); Anthropic
  implementation + deterministic mock for dev/tests
- **Print** — provider-agnostic adapter (`src/lib/print/provider.ts`);
  Prodigi implementation + mock, white-label to customers
- **PDF** — HTML template → headless Chromium → press-ready PDF, with
  automated preflight (DPI, bleed, fonts, page count, overflow)

## Architecture map

```
src/lib/ai/         provider.ts (interface) · anthropic.ts · mock.ts · prompts.ts
src/lib/print/      provider.ts (interface) · prodigi.ts · mock.ts
src/lib/pdf/        html.ts (templates) · render.ts (Chromium) · preflight.ts
src/lib/book/       structure.ts · generate.ts (pagination) · templates.ts · provenance.ts
src/lib/editorial.ts  banned-phrase / unsupported-claim lint for all AI copy
src/lib/jobs/       queue.ts (Postgres queue, idempotent) · handlers.ts
src/app/            landing, auth, onboarding, dashboard, upload, clusters,
                    little things, questions, book editor/preview/approve,
                    checkout, orders, account, admin
supabase/migrations 0001 schema · 0002 RLS · 0003 private storage buckets
scripts/            seed.mjs (Florence demo family) · run-jobs.mjs
```

### Hard product rules, enforced in code

1. **Provenance (§14)** — every AI-drafted factual block must cite source
   memory/answer ids. Enforced three times: a Postgres CHECK constraint on
   `book_content_blocks`, `enforceProvenance()` on all provider output, and
   the "Why is this here?" UI in review mode.
2. **Editorial (§13/§29)** — `lintCopy()` rejects purple prose, clichés and
   unsupported emotional/"first" claims. Violating AI copy is **omitted,
   never repaired**. Parent copy is never censored.
3. **Privacy (§4)** — RLS on every table; both storage buckets private;
   printers receive only short-lived signed URLs; media never leaves
   Supabase except to the printer at order time.
4. **Print safety (§21)** — orders require an explicit approval record
   (checklist + confirmation); `submit_print` refuses unapproved books;
   idempotency keys make duplicate orders impossible.

## Getting started

```bash
npm install
cp .env.example .env.local          # fill in Supabase keys at minimum
# apply supabase/migrations/*.sql to your Supabase project (in order)
npm run dev
```

Defaults run with **mock AI and mock print providers** — the entire flow
(upload → clusters → questions → book → approval → "order") works locally
with no external services beyond Supabase.

### Demo data

```bash
npm run seed     # creates demo@keeper.test with Florence (age 2), 41 memories
npm run jobs     # drains the job queue: analysis → clusters → questions
```

### Background jobs

Jobs live in the `jobs` table and are claimed via `claim_job()`
(FOR UPDATE SKIP LOCKED). Trigger processing with:

```bash
curl -X POST -H "x-jobs-secret: $JOBS_SECRET" localhost:3000/api/jobs/run
```

In production, point a scheduler (e.g. Supabase cron / external cron) at
that endpoint every minute, and at `poll_print_status` cadence for orders.

### Tests

```bash
npm test         # editorial, provenance, structure, preflight, print adapter,
                 # pagination, and static RLS/storage security checks
```

## Development phases (brief §30)

- ✅ Phase 1 — auth, child profile, memory upload, private storage, metadata
- ✅ Phase 2 — AI analysis, clustering, questions, Little Things (mock + Anthropic providers)
- ✅ Phase 3 — book structure, copy generation, provenance
- ✅ Phase 4 — constrained book editor, Chromium PDF renderer, preflight
- ✅ Phase 5 — Stripe checkout/webhook, print adapter (Prodigi + mock), order tracking
- ⬜ Phase 6 — production hardening: live Supabase RLS integration tests,
  Prodigi sandbox order, physical paper samples (§17 — do not commit to
  paper until samples inspected), voice-note transcription, thumbnails,
  image-content analysis with real vision models, deletion self-service.

## Notes / deliberate MVP cuts

- Voice memories: schema + types support them; recording UI is post-MVP.
- Cover PDF currently reuses interior render; a dedicated cover template
  (spine width from page count) is required before real Prodigi orders.
- `recipient_json` is stored in Postgres (RLS-protected, service-role
  writes); move to column-level encryption before production.
- Admin is intentionally minimal and can never bypass parent approval.
