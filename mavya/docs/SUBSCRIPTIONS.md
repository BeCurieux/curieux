# Ovyko's plan: what schools pay Ovyko

How Ovyko earns its subscription (`docs/BUSINESS_PLAN.md`, pricing), on top
of its 0.5% share of online payments (`docs/M7_PAYMENTS.md`). Built
4 October 2026.

## Decisions (owner of Ovyko, 4 October 2026)

1. **A$399 a month per location.** One price. The amount is set on the
   price in Ovyko's own Stripe account (`STRIPE_SCHOOL_PRICE_ID`), where
   GST is handled once Ovyko's GST position is confirmed.
2. **30 days free.** Every new school's trial starts when the school is
   created. Adding payment details during the trial doesn't cut it short.
3. **Paid monthly by card or direct debit**, through Stripe Billing on
   Ovyko's own Stripe account (not the school's). Stripe emails the
   invoices, retries failed payments and keeps the card details.
4. **Owners manage it themselves** in Settings → Ovyko plan: start the
   plan, see its state and the number of locations billed, update the
   card, see invoices or cancel (Stripe's billing page).
5. **Nothing stops working if a school doesn't pay.** Lessons, families
   and payments carry on; children are never caught in a billing problem.
   The owner sees a reminder on every business page until it's sorted,
   and the owner of Ovyko follows up in person. Demo schools aren't
   billed.
6. **Locations billed follow the school.** If a school adds or closes a
   location, the owner updates the plan from the same page.
7. **Ovyko's totals** add paying schools and monthly recurring revenue.

## Data model

- New `SchoolSubscription`: the school's Stripe customer and subscription,
  status (trialing, active, past due, cancelled, …), locations billed,
  price per location, trial end, current period end, whether it cancels
  at the period's end.

## Not in this slice

- Annual plans, discounts and tiers.
- Locking a school out for not paying.

## Acceptance criteria

- A new school is in its 30-day trial; after it, owners without a plan
  see a reminder on business pages.
- An owner starts the plan on Stripe's page, with the trial kept; Stripe's
  messages keep Ovyko's record of it up to date; owners manage it on
  Stripe's billing page.
- Only the school's owners see or manage its plan; only the server
  records it.
- Ovyko's totals show paying schools and monthly recurring revenue.
