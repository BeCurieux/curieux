# M5.5 — Automatic offers

## Goal

The engine fills places by itself (`docs/STRATEGY.md`, must-have 2). When an
absence opens a spot, the best-fitting family with a make-up credit is
offered it straight away. If they say no or don't answer in time, the next
family is offered it. Nobody at the front desk does anything; the owner
sees what happened.

## Decisions

1. **On by default, the school's choice.** Two new make-up rules:
   `auto_offer` (default on) and `offer_hold_minutes` (default 120, between
   15 minutes and 24 hours), set in Settings → Make-up rules.
2. **One family holds a spot at a time.** For each open spot the engine
   makes one offer, held for the hold time or until 30 minutes before the
   lesson, whichever is sooner. It doesn't offer lessons starting within the
   next 45 minutes. Offers an owner makes by hand work as in M5 (first to
   claim wins).
3. **Who goes first.** Among children `check_makeup` allows: families with a
   parent account (someone who can answer), then the soonest-expiring
   credit, then the earliest missed lesson. A child already offered this
   lesson (declined, expired or claimed) isn't offered it again, and a child
   never holds more open offers than they have credits.
4. **When the engine runs.** Straight after an absence is reported, a
   make-up is cancelled, an offer is declined or claimed, or the rules are
   saved; and every five minutes, so offers that ran out move to the next
   family (a database schedule, `pg_cron`).
5. **Offers stay honest.** When a child's credit is used (a make-up booked
   or a spot claimed) or taken back (the absence withdrawn), their other
   open offers close as `withdrawn` (a new status: unlike declined or
   expired, it doesn't stop the child being offered that lesson later). A
   child is never left holding an offer they can't take.
6. **Eligibility has one home.** The rules `check_makeup` applied move into
   `private.makeup_reasons`, which the engine uses without a signed-in
   caller; `check_makeup` keeps its caller check and calls it. Nothing about
   the rules changes.
7. **Visible and reversible.** Automatic offers have no `offered_by`; the
   Fill Empty Spots page marks them "Offered automatically" with the time
   left. Every offer is audited. Turning the rule off stops new offers;
   open ones run their course.

## Scope

- Business: the two new rules; Fill Empty Spots shows automatic offers.
- Family: the offer appears on Home (alongside, not instead of, the next
  thing to do) and in Messages, as in M5.
- Demo: Zoe Martin's mother gets a parent account
  (`claire.martin@family.test`), so two Aqua House families can be offered
  the same spot.

## Not in M5.5

- Email and push delivery of offers (M6).
- Learning which families accept which times (after the pilot, with data).
- Waitlists for permanent places.

## Acceptance criteria

- Reporting an absence offers the spot to the best-fitting family at once,
  without the owner.
- Declining (or letting it run out) offers it to the next family.
- A family whose credit is used or withdrawn loses their open offers.
- With `auto_offer` off, nothing is offered automatically.
- Automatic offers keep every M5 guarantee: family-only, once, never who is
  away, the last spot only once.
