# weekend-autopilot

Working brand: **52 Weekends** — *provisional, and deliberately not hard-coded anywhere.*

> You get 52 weekends a year. We'll make them count.

One personalised, verified, executable weekend plan, delivered every Thursday morning.
Not a discovery directory, not a list of recommendations, not a chatbot. The value
is not information — it is **removing the decision**.

Sydney only at launch. Mobile-first web app and email; no native app.

---

## What this actually is

```
PROFILE → CONTEXT → DISCOVER → FILTER → BUILD → VERIFY → DELIVER
                                                              ↓
              BETTER NEXT WEEK ← LEARN ← “DID YOU DO IT?” ←────┘
```

The crown jewel is the **planner + verification + taste** system, not the UI.
Everything else exists to get a plan in front of someone and get one answer back.

**The rule the whole system is built on:** AI decides, APIs provide facts. The model
never supplies a venue, an opening time, a price, a distance or a forecast. It reasons
about facts we fetched, chooses among plans we assembled, and writes the copy. Every
factual claim on a plan item carries provenance.

---

## Getting it running

```bash
npm install
cp .env.example .env.local     # works as-is: every provider defaults to a mock
npm run dev
```

With no keys configured the app runs entirely on fixtures — a synthetic Sydney place
set, a deterministic router, scripted weather and a rule-based AI provider. That is
enough to walk the whole product, and it is what CI runs against.

With a Supabase project:

```bash
# apply supabase/migrations/*.sql in order, then
npm run seed      # three households (couple, family with a 4-year-old, solo)
npm run jobs      # generate their plans
```

| Command | |
|---|---|
| `npm run dev` | development server |
| `npm run test` | unit + integration + evals (270 tests, no network) |
| `npm run test:evals` | just the synthetic-profile suite |
| `npm run test:e2e` | Playwright, mobile and desktop |
| `npm run typecheck` | strict TypeScript, no `any` |
| `npm run jobs -- --watch` | drain the job queue locally |
| `npm run seed` | development households |

---

## The brand is configuration

"52 Weekends" is a working name. Nothing customer-facing hard-codes it — not a page,
an email, a Stripe description or an alt attribute. Everything reads
`src/config/brand.ts`, which reads the environment:

```
NEXT_PUBLIC_PRODUCT_NAME
NEXT_PUBLIC_PRODUCT_TAGLINE
NEXT_PUBLIC_PRODUCT_DOMAIN
NEXT_PUBLIC_SUPPORT_EMAIL
```

`tests/unit/brand.test.ts` walks the source tree and fails if the literal appears
anywhere except that one file. A rename is a config change, including the PWA name
and the app icon, which is generated from the configured initials.

Markets work the same way (`src/config/markets.ts`): currency, locale, timezone,
units, geographic bounds and the delivery/feedback schedule. Adding London is a data
change plus a candidate-source review. Nothing anywhere says `Australia/Sydney`.

---

## Layout

```
src/config/          brand, markets, feature flags, scoring weights, taxonomy
src/lib/
  planner/           ← the crown jewel
    context.ts         reconcile stated vs behavioural vs situational
    search-intents.ts  what kind of thing to look for (§14)
    candidate-builder  retrieval, pruning, routing, enrichment
    filters.ts         hard rejections, each with a rule and a reason (§15)
    scoring.ts         deterministic 0–100, weights from config (§17)
    bundle-builder.ts  assemble real days with real times (§16)
    verification.ts    the gate before delivery (§20)
    generation.ts      the pipeline
  taste/             structured signals, not an AI blob (§19)
  providers/         places · routes · weather, each with a mock
  ai/                provider-agnostic, Zod-validated, versioned prompts
  jobs/              durable queue + weekly scheduler
  billing/ notifications/ analytics/ security/ db/
src/app/             (marketing) (auth) (product) admin api
supabase/migrations/ schema, RLS, functions
tests/               unit · integration · evals · e2e
docs/                architecture notes and deviations
```

---

## Things worth knowing before you change something

**Scoring weights live in config, never in a prompt.** `src/config/scoring.ts`. That is
what makes a bad recommendation debuggable: you can point at a dimension instead of
re-reading a paragraph of English.

**Three states, not two, for opening hours.** `OPEN`, `CLOSED` and `UNKNOWN` are
different. Collapsing unknown into closed silently deletes most small venues; collapsing
it into open sends a family to a locked door. Unknown is penalised, surfaced to the
customer as "worth checking", and never asserted.

**Behaviour outweighs what people said.** Tick "culture" at signup and decline four
museums, and museums stop appearing — regardless of the original selection. That case is
`tests/evals/profiles.test.ts`, Example E.

**"Plans changed" teaches us nothing.** Not every "no" is about the recommendation. A
visiting sister, bad weather we got wrong — those move no taste signals. Only
"didn't appeal" moves the category.

**Cost discipline is architectural.** Search wide → prune with free arithmetic → pay for
routing → pay for details on the shortlist only. Reversing that order multiplies the cost
per plan by the search fan-out. There is a per-run ceiling and a test asserting the
ordering.

**The founder-review switch is a training wheel.** `REQUIRE_PLAN_REVIEW=true` holds plans
in `PENDING_REVIEW`; nothing else about the pipeline changes. The admin queue exists to
show you *where the autonomous system is wrong* — the rejected-candidate list with rule
names is the useful part, not the plan itself. Turning it off is one environment variable.

**Location is deliberately coarse.** Coordinates are rounded to ~100 m at write time.
There is no location history table, and "did you do it?" is self-reported. This is a
product constraint, not a setting.

---

## Testing

| | |
|---|---|
| `tests/unit` | scoring, filters, taste, timezones, verification, brand, security |
| `tests/integration` | provider normalisation, Stripe webhooks, emails, whole pipeline |
| `tests/evals` | the five synthetic profiles from the brief, asserted as behaviour |
| `tests/e2e` | Playwright; public surface runs anywhere, signed-in journey needs a seeded environment |

No test makes a paid provider request. The eval suite runs the *real* filters, scorer,
assembler and verifier against fixtures — only the outside world is mocked, so when they
pass the deterministic half of the engine is genuinely correct.

Two real bugs the tests caught while being written, both now regression-tested: the
bundle builder scheduling the same venue twice in one day, and marking the *first*
scheduled item critical rather than the anchor (which meant verification weighted a
coffee stop three times as heavily as the reason for the day).

---

## Deployment

Vercel. Two crons, both authenticated with `CRON_SECRET`:

| Path | Schedule | |
|---|---|---|
| `/api/cron/schedule` | hourly | asks each live market whether its generation hour has arrived |
| `/api/jobs/run` | every 5 min | drains the queue |

Sydney's week: generate Wednesday 19:00, deliver Thursday 07:30, ask Sunday 18:30 —
all market-local, correct across daylight saving.

See `docs/architecture.md` for the deviations from the brief and why, and
`docs/runbook.md` for what to do when a Thursday goes wrong.
