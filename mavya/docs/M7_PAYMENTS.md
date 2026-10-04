# M7 — Payments

## Goal

Make money understandable, then make it move by itself. Payments are the
main reason a school already collecting fees elsewhere can't switch
(`docs/BUSINESS_PLAN.md`), and roughly double what each school is worth.
They ship in slices, safest first:

| Slice | What |
|---|---|
| **M7a** | **Family accounts**: what each family owes for the term, worked out from the timetable; payments the school took elsewhere; credits; a clear statement for parents. No money moves through Ovyko yet. |
| **M7b** | **Stripe Connect**: schools approved to take payments; parents pay a term upfront by card or direct debit; receipts. |
| **M7c** | **Due dates and fee reminders; failed payments chased** (part 1). **Instalments** (part 2). |
| **M7d** | **Government activity vouchers** (part 1). Xero sync waits on the owner: CLAUDE.md rule 14 rules Xero out of v0.1. |

Decisions from the owner of Ovyko (3 October 2026), for all of M7:

- **Pricing:** per term, by lessons: price per lesson × lessons in the
  term. Joining part-way through costs less automatically.
- **Card and bank fees:** ~~each school chooses to absorb them or pass them
  on as a surcharge~~. Changed by law: from 1 October 2026 Australian
  businesses may not surcharge debit, credit or prepaid cards (Reserve
  Bank, March 2026). Schools absorb the fee, as with any card terminal.
- **Ovyko's income:** a small, clearly shown percentage on top of Stripe's
  fee (from M7b).
- **First step:** family accounts, before any card payments.

## M7a — Family accounts

### Decisions

1. **A price per lesson on each class.** Owners set it on the class
   (optional; a class without a price isn't charged). Dollars and cents,
   stored as whole cents.
2. **Every amount is a line, never an edited total.** Each family has an
   account made of lines: charges (term fees, other charges), payments,
   credits and refunds. A line is never changed or deleted; a mistake is
   cancelled by a matching opposite line, with a reason. The balance is the
   sum of the lines. This is the ledger the build plan calls for, and what
   card payments (M7b) will write to.
3. **Term fees from the timetable.** On a term's page the owner taps
   "Create term fees". Each child gets one charge per class for the term:
   the class's price × the class's lessons in the term (each week the
   class meets between the term's first and last day). Who's charged:
   - children in a class now, unless they told the school they're leaving
     that term (M6e);
   - children moving up are charged for their new class;
   - a term already under way is charged from today, so a newcomer pays
     only for the lessons left.
   Running it again adds only charges that are missing (a child enrolled
   since), never doubles one.
4. **Recording money taken elsewhere.** Until card payments arrive, the
   owner records payments the school took by bank transfer, card terminal,
   cash or another system: amount, how, the date, an optional note.
5. **Credits and other charges.** The owner can add a credit (a sibling
   discount, a goodwill credit, a voucher) or a charge (a cap, a late
   fee) with a reason.
6. **Cancelling a line.** The owner cancels a wrong line with a reason; an
   opposite line is added and both stay visible.
7. **Parents see their statement.** On the family app, "Fees": the
   balance ("You owe $230" or "You're paid up") and every line, newest
   first, in plain words. Read-only for now.
8. **Owners see who owes what.** An "Accounts" list in Settings: every
   family with a balance, largest first, and the school's total owed. Each
   family's page shows its account and the owner's actions.
9. **Need to know.** Only the school's owners and the family's own parents
   see an account. Instructors don't. Audited like everything else;
   deleting a family removes its account.

### Data model

- `classes.price_per_lesson_cents` (nullable).
- New `LedgerEntry`: organisation, family, child (optional), kind (term
  fee, charge, payment, credit, refund, cancellation), amount in cents
  (positive adds to what's owed, negative reduces it), description, term,
  class and lessons × price (for term fees), payment method and date (for
  payments), the line it cancels, who added it, when, and a key that stops
  the same term fee being created twice.

### Not in M7a

- Taking card or direct debit payments, receipts, card-fee surcharges and
  Ovyko's percentage (M7b).
- Instalments and chasing failed payments (M7c).
- Vouchers and Xero (M7d).
- GST handling on statements: confirm with an accountant whether lessons
  carry GST before receipts are tax invoices (M7b).
- Charging for casual places and make-ups.

### Acceptance criteria

- An owner sets a price per lesson on a class.
- Creating term fees charges each continuing child price × lessons in the
  term, charges movers for their new class, skips leavers, charges a term
  under way only for the lessons left, and doubles nothing when run again.
- An owner records a payment, adds a credit or charge, and cancels a line
  with a reason; the balance follows.
- A parent sees their own family's balance and lines, and no one else's;
  instructors and other schools see none.
- Lines can't be changed or deleted by anyone; every line is audited.

## M7b — Card and direct-debit payments

Built and tested against Stripe's own test double (stripe-mock) before the
owner's Stripe account existed; switched on by adding the Stripe keys.

### Decisions

1. **Each school connects its own Stripe account.** Stripe's own sign-up
   checks who the school is. The school is the seller: its name is on the
   bank statement, payouts go to its bank account, it pays Stripe's fee,
   and it handles refunds and disputes in its Stripe dashboard. Families'
   money never passes through Ovyko. (Stripe Connect, direct charges, the
   school with a full Stripe dashboard.)
2. **Parents pay what's owing from Fees.** "Pay $230" opens Stripe's own
   secure payment page: card, Apple Pay, Google Pay, or direct debit from
   a bank account (BECS), whichever the school has turned on. Ovyko never
   sees card or bank numbers. A direct debit already on its way is taken
   off the amount to pay.
3. **The account follows the money.** A card payment is added to the
   family's account as soon as Stripe confirms it. A direct debit shows
   "on its way" (up to three business days) and is added when it clears;
   if it fails the parent sees that it didn't go through (chasing failed
   payments is M7c).
4. **A receipt by email** to the parent who paid. It is called a receipt,
   not a tax invoice, until an accountant confirms whether lessons carry
   GST.
5. **No surcharges** (the law, above). Stripe's prices in Australia from
   1 October 2026: 1.65% + 30c for Australian cards online; direct debit
   1% + 30c, at most $3.50.
6. **Ovyko's fee: 0.5% of each online payment** (the business plan's
   figure; the owner of Ovyko can change it). Stripe takes it
   automatically; owners see it on their Payments page and in Stripe.
   Money recorded by hand carries no fee.
7. **Refunds are made in Stripe**, and are added to the family's account
   automatically, including part refunds. An online payment can't be
   cancelled in Ovyko: that would say the family owes money it paid.
8. **Only real payments count.** Messages from Stripe are checked by
   their signature, and a payment counts only if it comes from the
   school's own Stripe account, for the payment Ovyko started, for the
   right amount. Running the same message twice changes nothing.
9. **Need to know.** Only owners connect Stripe and see payment details;
   parents see their own family's payments; instructors see none.
   Everything is audited.

### Data model

- New `PaymentAccount`: a school's Stripe account and whether it can take
  payments yet.
- New `OnlinePayment`: a payment a parent started: family, amount,
  Ovyko's fee, status (started, on its way, paid, failed, expired),
  Stripe's references, the method, how much has been refunded, and the
  account line it became.
- `LedgerEntry`: payment method "direct debit"; the online payment a line
  came from.

### Not in M7b

- Instalments, saved cards and automatic chasing (M7c).
- Paying part of the balance, or paying ahead.
- Vouchers and Xero (M7d).

### Acceptance criteria

- An owner sets up payments through Stripe's sign-up and sees when the
  school can take payments, and Ovyko's fee.
- A parent pays what's owing; once Stripe confirms, the balance drops,
  the statement shows the payment and a receipt is emailed.
- A direct debit shows as on its way, then paid or failed.
- A refund in Stripe adds a refund line, once, however many times Stripe
  says so.
- A message that isn't signed by Stripe, comes from another school's
  Stripe account, or names the wrong amount changes nothing.
- Parents can't pay another family's account; instructors and other
  schools see no payments.

## M7c part 1 — Due dates and fee reminders

Chasing money is the job owners hate most. Part 1 makes Ovyko do it.
Instalments are part 2: they need the owner of Ovyko to decide how many
instalments, whether schools can charge for them, and saving a parent's
bank details for later debits.

### Decisions (defaults chosen by Claude; the owner can change them)

1. **Every charge has a due date.** A term fee is due on the term's first
   day, or on the day it's added if the term is under way. Any other
   charge is due the day it's added.
2. **What's overdue.** Whatever a family owes that was due before today.
   Payments count against the oldest charges first, so this is the
   balance less charges not yet due (and less direct debits on their way).
3. **Fee reminders, if the school switches them on** (off until it does:
   they are emails to its customers). At 9am school time:
   - a week before a due date: "fees due soon", if anything is owing;
   - on the due date, if it's still owing;
   - a week and two weeks after, if it's still overdue. Then Ovyko stops,
     and the owner follows up in person.
   Each email names the school and the amount, never a child, and links
   to Fees, where the parent can pay. It is checked again just before
   sending, so a family that has paid gets nothing.
4. **A failed direct debit is chased at once.** The parent who paid gets
   an email that it didn't go through, with a link to pay again. This is
   about their own payment, so it is sent whether or not reminders are on.
5. **Owners see what's overdue.** Settings → Accounts shows the total
   overdue and each family's overdue amount, and has the reminders switch.
   Parents see each fee's due date on their statement.

### Data model

- `LedgerEntry.due_on` (charges and term fees).
- `Organisation.fee_reminders` (off by default).
- Emails: fee reminder; payment didn't go through.

### Not in M7c part 1

- Instalments and saved payment details (part 2).
- Late fees (an owner can add a charge by hand).
- Text messages.

### Acceptance criteria

- Term fees are due on the term's first day (or the day added, mid-term);
  other charges the day they're added.
- With reminders on, a family owing money gets the week-before, due-day,
  and one- and two-week-overdue emails, once each, and none once paid or
  if the charge was cancelled. With reminders off, none.
- A failed direct debit emails the parent at once.
- Owners see overdue amounts; only owners can switch reminders, and the
  change is audited.

## M7d part 1 — Government activity vouchers

Families on tight budgets pay part of their fees with state vouchers. Today
they hand a code to the school, which redeems it in a government portal
and adjusts the bill by hand. Ovyko keeps track of every voucher.

The schemes (October 2026):

| Scheme | Value | Notes |
|---|---|---|
| NSW Active and Creative Kids | $50 | Two a year per eligible child |
| Queensland FairPlay | up to $200 | One a year per child |
| SA Sports Vouchers | $100 | Two a year per child |
| WA KidSport | up to $300 | A year per eligible child |

### Decisions (defaults chosen by Claude; the owner can change them)

1. **Each school picks the schemes it's registered for**, in Settings →
   Accounts. Parents see only those.
2. **Parents hand over a voucher in Ovyko**, on Fees: which child, which
   scheme, the voucher's code. Nothing comes off their fees yet.
3. **The school redeems it** in the government's own portal (Ovyko can't),
   then taps "Redeemed" with the amount the portal gave (at most the
   scheme's value). Ovyko adds a credit to the family's account, named for
   the scheme. Or the school declines it with a reason, which the parent
   sees.
4. **No voucher twice.** A code can be handed over once per school.
5. **Need to know.** Only the school's owners and the family's parents see
   a family's vouchers. Everything is audited.

### Data model

- `Organisation.voucher_schemes`: the schemes a school accepts.
- New `VoucherClaim`: organisation, family, child, scheme, code, amount,
  status (handed over, redeemed, declined), the reason if declined, who
  handed it over and who decided, when, and the credit it became.

### Not in M7d part 1

- Redeeming through a government system (none offers one to software).
- Xero (waiting on the owner: CLAUDE.md rule 14).

### Acceptance criteria

- An owner chooses schemes; parents see only those.
- A parent hands over a voucher for their own child; not twice, not for
  another family's child, not for a scheme the school doesn't take.
- An owner redeems it (a credit, at most the scheme's value) or declines
  it with a reason; the parent sees which.
- Instructors and other schools see none.

## Review fixes (4 October 2026)

A review of the money code before real payments found no way for anyone
to see or change another family's or school's money, and these fixes:

- **No paying twice.** Tapping Pay again reopens the payment page already
  open (or replaces it once Stripe says it expired), never a second one.
- **Refunds, failed refunds and lost chargebacks can't be lost.** A message
  about a payment not yet confirmed is sent again later by Stripe rather
  than ignored. A refund that fails puts the money back on the account; a
  chargeback the school loses means the family owes it again. Each counts
  once.
- **Stripe's word, not the message's.** For account changes Ovyko asks
  Stripe how the account stands now, so an old message can't undo a newer
  one. A school that disconnects Ovyko from Stripe stops taking payments
  in Ovyko.
- **Deleting a term, class or child with fees works.** Lines stay; only
  their reference to what was deleted is cleared. Amounts still can't
  change.
- **Vouchers.** A declined code can be handed over again; cancelling a
  voucher's credit (a wrong amount) puts the voucher back to redeem again.

## M7c part 2 — Instalments

Decisions from the owner of Ovyko (4 October 2026): 2 or 4 instalments a
term, no extra fee, each school chooses whether to offer them. The rest
are defaults chosen by Claude; the owner can change them.

### Decisions

1. **Schools switch instalments on** in Settings → Payments (off until
   they do).
2. **Parents choose on Fees**, when at least $100 is owing: pay in full,
   in 2 payments four weeks apart, or in 4 payments two weeks apart. The
   first is paid now; amounts are equal (the first takes any odd cents).
3. **The first payment saves the card or bank account** on Stripe's page,
   with the parent's agreement, for the later ones. Ovyko never sees it.
4. **Later payments are taken automatically** on their dates, at 9am
   school time. Each gets a receipt. A direct debit shows as on its way
   until it clears.
5. **If one fails**, the parent is emailed at once with a link to pay, and
   the rest of the plan stops: what's left is simply owing, and the usual
   reminders apply. Nothing is retried behind the parent's back.
6. **The Fees screen shows the plan:** what's paid and what's next. A
   parent can pay the rest at any time, which ends the plan.
7. **Reminders and "overdue" skip amounts a plan will take.** Charges
   added after a plan started are paid separately.
8. **One plan at a time per family.**

### Data model

- `Organisation.instalments_on`.
- New `InstalmentPlan`: family, number of payments, total, status
  (pending, active, completed, stopped), the saved Stripe customer and payment
  method on the school's account, who started it.
- New `Instalment`: plan, number, amount, date, status (scheduled, on its
  way, paid, failed, cancelled), the online payment that took it.

### Acceptance criteria

- With instalments off, parents see only "Pay in full".
- A parent starts a plan of 2 or 4; the first payment is taken on
  Stripe's page and the card or bank account is saved for the rest.
- On their dates the rest are taken automatically, once each, and added
  to the account; a failed one stops the plan and emails the parent.
- Paying the rest ends the plan. Reminders skip amounts a plan will take.
- Only the family's parents start a plan for their family; only the server
  takes payments.

### How it works

- `start_instalment_plan` writes the plan and its instalments and starts
  the first payment; the server opens Stripe's page for it with
  `setup_future_usage: off_session`, so Stripe saves the card or bank
  account on the school's account. When Stripe confirms it, the webhook
  asks Stripe which payment method was saved and records it on the plan
  (`attach_plan_payment_method`).
- Every hour the database's schedule (`private.kick_instalments`) calls
  `/api/payments/instalments` once an instalment is due and it's 9am or
  later at the school. The server claims what's due
  (`claim_due_instalments`, each one once) and creates an off-session
  payment on the school's account, with Ovyko's 0.5%, keyed by the
  payment's id so a retry never charges twice.
- Stripe's answer, and its later `payment_intent.*` messages, are
  recorded by `settle_instalment_payment`, then exactly as a page payment
  (a ledger line, a receipt, or a failed-payment email).
- A payment that needs the parent present (a bank asking for a code)
  counts as failed: the plan stops and the parent pays the rest on the
  Fees screen.

Tests: `tests/rls/instalments.test.ts`, `tests/e2e/instalments.spec.ts`.
