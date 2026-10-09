# Try it yourself

A button on the website that opens a pretend swim school for the visitor,
so a school owner can look around Ovyko in their own time without a call,
a sign-up or a password. Asked for by the founder on 6 October 2026, for
outreach emails that say "have a play" instead of "can we talk".

## What the visitor gets

- "Try it yourself" on the website (the hero, and under the demo video).
- One tap: a throwaway sign-in is made, a school called **Seaside Swim
  School** is made and filled, and they land on its Today screen as its
  owner, "Alex".
- The school has a pool (Erina), four levels, six classes, 13 families,
  a month of past lessons with attendance, two make-up credits (one about
  to run out), three families waiting for a full class (a new-class
  opportunity), this term's fees with two families behind, and three
  families showing warning signs (missed lessons, a paused place, overdue
  fees).
- A busy week, so Today isn't a screen of zeros (9 October 2026, after the
  founder asked for a clearer demo):
  - classes today, in two days and in five, whatever day the school is
    made; the Starfish classes are in two and five days, so their spots
    are always inside "this week";
  - two children away this week (Charlie and Henry), so there are 2 spots
    to fill, with children holding make-up credits ready to offer them to.
    Ovyko only offers automatically to families with the parent app, which
    pretend families don't have, so the visitor taps "Offer spot" themselves;
  - two make-ups that already happened, and four families who paid online
    this month (pretend payments, no card).
- **Try these four things** on Today, in place of the set-up steps (which
  a visitor didn't do): fill a spot, see who might leave, see what families
  want, record a payment (opens the Harper family). Each is one tap.
- A banner on every business screen: it's pretend, nothing sends emails or
  takes payments, when it's deleted, a link to join the founding schools,
  and "Leave the demo" (signs out).

## Decisions

- **One school per visitor**, not one shared demo: no visitor sees what
  another typed, and nothing needs resetting.
- **Deleted after a day** by an hourly job (`forget_demo_schools`), with
  everything in it and its sign-in. Audited rows are deleted first, while
  the school still exists for their audit entries, then the audit trail,
  then the school.
- **Limits:** 5 a day from one visitor (a one-way hash of their internet
  address, never the address; kept a week) and 300 at once. Over either,
  the visitor is told plainly. A hidden field turns away simple bots.
- **Throwaway sign-ins** are `try-<random>@demo.ovyko.invalid` with a
  random password nobody sees. `.invalid` can never receive email.
- **Nothing reaches the real world**, enforced by the database, not the
  screens:
  - no invites (they would email a real person);
  - no public waiting-list page (it would put a visitor's words on the web);
  - no payment account or Ovyko plan, even written with the secret key,
    and the app never calls Stripe for a pretend school;
  - any email queued for a pretend school or a throwaway sign-in is
    skipped, never sent.
- A pretend school is a demo school (`is_demo`), so it's left out of
  Ovyko's totals and isn't billed.
- Only the website, with the secret key, can make one
  (`create_demo_school`).

## Data

- `organisations.demo_expires_at` — set only for pretend schools.
- `demo_visits` — one row per pretend school made: the visitor hash and
  when. No one but the secret key reads it.

## Tests

- `tests/rls/try_demo.test.ts`: only the secret key makes one; it's
  filled as described, with 2 spots to fill, 2 make-ups done, 4 online
  payments and lessons this week; visitors can't see each other's; 5 a day; no
  invites, public page or payments; deleted when it expires.
- `tests/e2e/try-it.spec.ts`: tap the button on the website, land on Today
  with the banner, the tour (no set-up steps), 2 spots and warning signs;
  offer a spot; open the Harpers from the tour; see the families, payments switched
  off, leave the demo.

Migrations: `supabase/migrations/20261025000042_try_it_yourself.sql`, and
`20261026000043_livelier_demo.sql` (the busy week).
