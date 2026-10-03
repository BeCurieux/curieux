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
| M7c | Failed payments chased automatically; instalments. |
| M7d | Government activity vouchers (NSW Active and Creative Kids, Queensland FairPlay); Xero sync. |

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
