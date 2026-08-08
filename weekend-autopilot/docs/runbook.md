# Runbook

What to do when a Thursday goes wrong. Written to be read at 7am.

---

## The weekly cycle (Sydney)

| When (local) | What |
|---|---|
| Wed 19:00 | scheduler queues `generate-weekend-plan` for every active household |
| Wed 19:00→ | generation runs; plans land `PENDING_REVIEW` (or `READY` if review is off) |
| Thu 07:30 | `deliver-weekend-plan` sends whatever is `READY` |
| Sun 18:30 | `send-feedback-request` asks "did you do it?" |
| on answer | `process-feedback` updates the taste model |

Both crons are authenticated with `CRON_SECRET`. The scheduler runs hourly and
does nothing except in the generation hour; the job runner runs every 5 minutes.

---

## "It's Thursday morning and nothing was sent"

Check in this order.

**1. Did the plans get generated?**
```sql
select status, count(*) from plans
where weekend_date = '<this Saturday>' group by status;
```
- Rows in `PENDING_REVIEW` → review is on and nobody approved. Go to `/admin/queue`.
  Approving after Thursday 07:30 sends immediately rather than scheduling into the past.
- No rows at all → generation did not run. Continue to 2.

**2. Did the scheduler fire?**
```sql
select * from plan_generation_runs
where weekend_date = '<Saturday>' order by started_at desc limit 20;
```
- No runs → the Wednesday cron did not fire, or `CRON_SECRET` is wrong (the
  endpoint returns 401/503 rather than running open). Hit
  `/api/cron/schedule` manually with the bearer token.
- Runs with `succeeded = false` → read `error` and `diagnostics`. Continue to 3.

**3. Are jobs stuck?**
```sql
select type, status, attempts, last_error from jobs
where status in ('queued','running','dead') order by updated_at desc limit 30;
```
- `dead` → retries exhausted. Fix the cause, then requeue (`requeue()` in
  `src/lib/jobs/queue.ts`, or set `status='queued', attempts=0`).
- Lots of `queued` and nothing moving → the job-runner cron is not firing.

**4. Delivery specifically.**
```sql
select kind, status, error, sent_at from notifications
where household_id = '<id>' order by created_at desc limit 10;
```
`status='failed'` with an error is the email provider. The job retries; the
`idempotency_key` means a retry cannot double-send.

---

## "A customer got a bad plan"

Open `/admin/queue` if it is still pending, otherwise pull the run:

```sql
select diagnostics from plan_generation_runs
where id = (select generation_run_id from plans where id = '<plan id>');
```

`diagnostics` has the whole pipeline: intents, every rejected candidate with the
rule that rejected it, the shortlist with scores, the assembled bundles, the
verification result and the critic's verdict.

Ask which stage should have caught it:

| Symptom | Where it belongs |
|---|---|
| venue closed / does not exist | `verification.ts` — did it fail, or did we never check? |
| unsuitable for a child, too far, over budget | `filters.ts` — a missing or too-lenient rule |
| feasible but a poor choice | `scoring.ts` weights, or a missing penalty |
| good components, badly shaped day | `bundle-builder.ts` ordering or the archetype |
| plan is fine, copy is wrong | prompt in `src/lib/ai/prompts/` — bump the version |

Fix it as a rule, not as a one-off. A correction that does not become a filter,
a weight or a prompt version is a correction you will make again.

---

## "Generation keeps failing for one household"

Check `admin_flags` — repeated failures raise one automatically, and the
customer has already been told honestly rather than sent filler.

Usual causes:

- **Home location outside the market bounds.** `marketForCoordinates` returns
  null and the household should never have been created; check `home_lat/lng`.
- **Constraints that admit nothing.** 15 minutes on foot, free only, one
  category, in a storm. Look at `diagnostics.candidatesRejected` — if the rules
  are all firing correctly, this is a product answer, not a bug: widen a default
  or tell them.
- **Every intent returned nothing.** `diagnostics.emptyIntents`. Either the
  places provider is failing, or their liked categories have no coverage in
  their area.

---

## "Provider spend looks wrong"

The admin dashboard shows cost per plan over 30 days. Detail:

```sql
select provider, operation, sum(requests) req, sum(estimated_cost_cents)/100 usd
from provider_usage where created_at > now() - interval '7 days'
group by 1,2 order by usd desc;
```

Expect searches ≈ intents per run (≤ 8) and details ≈ shortlist size (≤ 12).
Details far exceeding searches means enrichment is happening before pruning —
see the cost model in `architecture.md`. A run that hit the ceiling logs
"Provider cost ceiling reached" in its verification diagnostics.

---

## Stripe

Subscription state comes from verified webhook events, never from a browser
redirect. If someone paid and has no access:

1. Was the event received and verified? A signature failure returns 400 and
   Stripe retries; a handler error returns 500 and Stripe also retries.
2. Did the session carry `household_id` in metadata? Checkout before signup is
   supported — the payment lands in `payments` with a null household and is
   attached when they onboard.
3. All handlers are idempotent, so replaying an event from the Stripe dashboard
   is safe and is usually the fastest fix.

---

## Turning founder review off (and back on)

`REQUIRE_PLAN_REVIEW=false`, redeploy. Plans go straight to `READY` and the
Thursday job delivers them; nothing else changes. Turning it back on is the same
switch — plans already `READY` are unaffected.

---

## Emergency: stop all delivery

Set `FLAG_FEEDBACK_EMAILS=false` and `REQUIRE_PLAN_REVIEW=true`. Generation
continues (so nothing is lost), delivery waits for a human, and no Sunday
emails go out. To also stop generation, disable the `/api/cron/schedule` cron in
Vercel — queued jobs will still drain, so clear `jobs` if you need a hard stop.
