# Ovyko totals

The numbers the owner of Ovyko needs to run the business and, one day, to
show a buyer (`docs/STRATEGY.md`, "Why a buyer like Xplor would buy
Ovyko"): how many schools, how much money flows through Ovyko, and Ovyko's
share. Built 4 October 2026.

## Decisions

1. **Numbers only.** Totals across every real school: schools, schools
   teaching in the next fortnight, schools taking payments, families,
   children enrolled, fees charged, money paid online and outside Ovyko,
   and Ovyko's share; and month by month for a year. No school, family or
   child is ever named (CLAUDE.md rule 15).
2. **Demo schools are left out.** Schools are marked as demo; the demo
   schools are.
3. **Only the people who run Ovyko**, listed in the database by hand (the
   SQL editor, never the app), and only after two-step sign-in, as owners
   do. Anyone else gets "not found".
4. **A private page, `/platform`**, not in any menu. A platform admin who
   doesn't own a school lands there after signing in.

Since `docs/SUBSCRIPTIONS.md`: also paying schools and monthly
subscription revenue.

## Not yet

- Schools that leave, month by month.

## Acceptance criteria

- A platform admin, after two-step sign-in, sees the totals and the last
  12 months; before two-step, they're asked for it.
- School owners, instructors, parents and anyone not listed can't read the
  totals or the list of admins, or add themselves to it.
- Demo schools aren't counted.
