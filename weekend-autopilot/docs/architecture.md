# Architecture notes

Decisions that are not obvious from the code, and the places where this build
departs from the brief. Written for whoever picks this up next, including a
future me who has forgotten why.

---

## Deviations from the brief

### Job orchestration: Postgres queue rather than Trigger.dev or Inngest

The brief suggests Trigger.dev or Inngest. This uses a Postgres-backed queue
(`jobs` table, `claim_job()` with `FOR UPDATE SKIP LOCKED`) drained by a cron
endpoint.

The reason is dependency surface on a Thursday morning. Plan generation already
requires Supabase; adding a second external orchestrator adds a second thing
that can be down when the week's deliveries are due, for a workload that is a
few hundred short jobs a week. The queue does what the brief actually asks for:
durable, retried with exponential backoff, idempotent, with the specified key
(`household_id + weekend_date + plan_type`).

The handlers in `src/lib/jobs/handlers.ts` are plain `(db, payload)` functions
with no knowledge of the queue. Moving to a hosted orchestrator later means
calling the same functions from a different trigger — a day's work, not a
rewrite. Do it when the queue starts needing a dashboard, fan-out or
cross-service workflows.

### shadcn/ui: vendored, without the CLI or Radix

The brief asks for shadcn/ui. `src/components/ui/index.tsx` is what shadcn
gives you after `init` — components you own, built on Tailwind and CVA — minus
a Radix dependency the current surface does not need. Nothing here is a modal,
a combobox or a focus-trapped popover; it is buttons, chips, cards and a
progress bar. Add Radix the first time a component genuinely needs its
accessibility machinery, not before.

### Map: inline SVG schematic rather than embedded tiles

§55 asks for a simple route overview with numbered stops and travel links.
`PlanMap` projects the stops we already hold into an SVG. No tile embed, so no
per-load cost on a page people open weekly and no tile terms to honour, and the
brief's "do not build a complex custom navigation product" is respected by
construction. Every stop has an "Open in Maps" link, which is what someone
actually uses when they are ready to leave.

### Currency symbols are explicit config

ICU renders AUD in `en-AU` as a bare `$`. Correct inside Australia, ambiguous on
a website, and not what our own copy says. `Market.currency_symbol` prints
`A$29`; Intl still formats the number.

---

## Things that look like details and are not

### The three-state opening-hours model

`OPEN` / `CLOSED` / `UNKNOWN` runs from the provider adapter through the filter
to the verifier and out to the customer as "worth checking before you go".

Both collapses are bad, in opposite directions. Treating unknown as closed
deletes most independent venues — precisely the ones worth recommending.
Treating unknown as open eventually drives a family forty minutes to a locked
door, which is the single worst thing this product can do. So it stays three
states, is penalised in scoring, reduces the verification score without
automatically blocking, and is disclosed.

### Why verification re-fetches instead of trusting the candidate

A plan is built on Wednesday and delivered on Thursday. Between those, a venue
can close permanently, a coordinate can be corrected, a Saturday transit
itinerary can disappear. Verification re-reads everything it is about to assert
and re-checks the main journey at the actual departure time. Cheap relative to
sending someone somewhere that is not there.

### Why a failed plan is regenerated, not repaired

When verification fails we drop the bundle and try the next-ranked one. Patching
is tempting and wrong: a plan is a sequence with dependent timings, and
substituting a component invalidates the schedule, the cost, the travel and
possibly the archetype. Re-running assembly from a candidate set we already have
is both simpler and more likely to be right.

### Why the anchor is the critical item

Verification weights the critical item 3× and `finalValidation` refuses to ship
a plan whose anchor failed. An early bakery is not the reason for the day.
This was a real bug: `is_critical` was set on the first *scheduled* component,
so on any plan with a morning coffee stop the weighting was attached to the
pastry. Regression test in `tests/unit/bundle-builder.test.ts`.

### Attribution in the taste model

The subtle part of learning is not the arithmetic, it is deciding what a signal
is evidence *of*.

- "Too far" is evidence about travel tolerance, not about beaches.
- "Loved it" on a coastal walk is evidence for water and for that walking
  distance — and much weaker evidence about the café they stopped at.
- "Plans changed" is evidence about their sister visiting. It moves nothing.

Blunt attribution — moving every category in the plan by the same amount — is
how a recommendation engine slowly learns nonsense while appearing to work.

### Confidence rises with corroboration and falls on contradiction

Weight and confidence are separate. A signal confirmed six times should not be
overturned by one bad Saturday, but it should become less certain. See
`applyDelta` in `src/lib/taste/signals.ts`.

---

## Cost model

Places and routing dominate the variable cost. The ordering in
`candidate-builder.ts` is load-bearing:

1. **Search** — one call per intent, ~8 intents, cheap per result.
2. **Straight-line prune** — free. Removes most candidates.
3. **Route** — paid, on survivors only.
4. **Score** — free.
5. **Details and prices** — paid, on the ~12-candidate shortlist only.

Reversing 3/5 with 2 multiplies cost by the search fan-out. `UsageLedger` meters
every adapter call, `provider_usage` records it per generation run, and the
admin dashboard divides by run count to give cost per plan. There is a hard
ceiling per run (`max_provider_cost_cents_per_run`) that aborts rather than
spending without bound, and
`tests/integration/pipeline.test.ts` asserts the ordering.

---

## Security posture

- **RLS everywhere, failing closed.** Operational tables have RLS enabled with
  *no* permissive policy, so a forgotten policy denies rather than exposes.
- **Three Supabase clients**, and using the wrong one is the bug class to watch:
  `userClient()` respects RLS, `serviceClient()` bypasses it (jobs, webhooks,
  admin), `anonClient()` for genuinely public writes.
- **`is_admin` is not self-grantable** — the profiles update policy re-reads the
  stored value.
- **Auth fails closed.** If the session cannot be verified — Supabase
  unreachable, keys missing — `currentUser()` returns null and the visitor gets
  the login page, not a stack trace.
- **Untrusted text is fenced and labelled.** Customer notes and provider strings
  are wrapped in `<untrusted>`, with the delimiter stripped from the payload, and
  every system prompt states that such content is never an instruction. This is
  defence in depth on top of the real control, which is that the model is never
  in a position to act on an instruction — it selects from candidate IDs.
- **Webhooks verify signatures** before touching state, always.
- **Redirects are validated.** An emailed magic link is attacker-influenced
  input.
- **Waitlist is insert-only.** Without a read restriction the table is an email
  list available to any visitor.

---

## Privacy posture (§51, §52)

Coordinates are coarsened to ~100 m *before* they are written, so the precise
value never exists in the database. There is no location-history table. "Did you
do it?" is a tap, never a location check. Payment records survive account
deletion for tax purposes with the household link severed and the email reduced
to a hash — the books reconcile, the person does not remain in them.

---

## What is deliberately not built

- **Overnight escapes (§31).** `plan_duration_days` exists and defaults to 1.
- **Calendar integration (§32).** Nothing about the context assembly assumes
  availability comes only from the profile; an availability source drops into
  `buildPlanningContext`.
- **"Your 52" (§35).** Not built, but the history it needs — plans, completions,
  distances, categories — is being preserved from the first weekend.
- **Affiliate links (§30).** Columns and a click table exist, behind a flag.
  The ordering rule matters: recommendations are ranked *before* affiliate
  eligibility is considered, and nothing in the scorer can see it. Keep it that
  way; it is the difference between monetising a good recommendation and
  corrupting one.
- **Native apps.** Deliberate. The behaviour we need is Thursday email → open →
  do it → Sunday tap, and none of it wants an install.

---

## When you turn off founder review

`REQUIRE_PLAN_REVIEW=false`. The bar, roughly:

- generation success rate above ~95% over a few weeks
- you are approving nearly everything unchanged
- the plans you *do* reject fail for reasons you have since encoded as a filter
  or a weight, rather than reasons you fixed by hand

The last one is the real test. Every rejection during the review cohort should
end as a change to `filters.ts`, `scoring.ts` or `planner.ts` — otherwise you
are not training the system, you are substituting for it.
