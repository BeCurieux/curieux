# OVYKO v0.1 — Build Plan

## Principle

Build in gates.

Do not start a later milestone until current acceptance criteria pass.

Every milestone also carries the security items listed for it in
`docs/SECURITY.md`, and every feature passes that file's checklist.

## M0 — Foundation
See `docs/M0_FOUNDATION.md`

Goal:
A secure, typed, testable multi-tenant base.

## M1 — Beautiful demo
See `docs/M1_DEMO.md`

Goal:
A production-quality interactive demo using seeded data.

## M2 — Real classes and enrolments

Implement:
- organisations
- locations
- families
- children
- programs
- levels
- classes
- occurrences
- enrolments

## M2.5 — Security hardening

Implement:
- sign-in rate limits (and no open sign-up)
- immediate staff removal

## M3 — Attendance and progress
See `docs/M3_ATTENDANCE_PROGRESS.md`

Implement:
- attendance
- skills
- progress assessment
- parent progress display
- achievement notifications (in the app; email and push arrive with Resend in M6)
- sign-out on shared devices
- neutral notification wording
- instructor screens laid out for iPads
- photo consent (if photos are used; v0.1 has none)

## M4 — Absence and make-up engine
See `docs/M4_MAKEUPS.md`

Implement:
- absence reporting
- policy configuration
- credit issuance
- eligibility service
- make-up discovery
- make-up booking
- roster privacy in make-up discovery
- cancel a day's lessons in one go (pool closure, weather): each child gets a
  make-up credit under the school's rules, and families are told

## M5 — Fill Empty Spots
See `docs/M5_FILL_SPOTS.md`

Implement:
- temporary capacity
- candidate matching
- vacancy offer
- claim flow
- concurrency safety
- vacancy privacy and single-use claim links
- "this term" tally on the owner's dashboard: make-ups delivered in spots
  that would have sat empty (no extra classes or instructor hours), and
  families kept. Most schools charge by the term, so an absence isn't lost
  fees; a dollar figure shows only for schools that sell casual places.
- preview before cancelling a day: "38 families, 38 credits, 2 make-ups
  cancelled" shown before the owner confirms
- every number is tappable: open any figure on Today or the tally and see
  exactly which classes, children or credits make it up
- instructor clash checks: warn when a class would put an instructor in two
  places at once, across classes and locations

## M5.5 — Automatic offers
See `docs/M5_5_AUTO_OFFERS.md`

The engine fills places by itself (`docs/STRATEGY.md`, must-have 2):
- when an absence opens a spot, the best-fitting families with a make-up
  credit are offered it straight away, with no owner tap
- each offer is held for a set time; if it's declined or runs out, the next
  family is offered it
- when a child's credit is used or withdrawn, their other open offers close
- the school turns this on or off and sets the hold time in Make-up rules
- the owner sees what the engine did, and can still offer by hand

## M6 — Migration and pilot

Ships in slices (`docs/M6_MIGRATION_PILOT.md`). M6a, moving a school in, is
done: classes, families, children and places from CSV, checked before
saving, with counts to compare and a 14-day undo.

Implement:
- ~~CSV family, children and class import~~ (M6a)
- ~~onboarding checklist~~ (M6b)
- ~~parent invites~~ (M6b, by link; by email with M6c)
- minimal internal admin support (granted by the school, time-limited, audited)
- Supabase Pro, with leaked password protection on
- ~~two-step sign-in for owners~~ (M6d)
- ~~email delivery of notifications, with the neutral wording from M3~~
  (M6c; push after the pilot)
- ~~lesson-day reminders to parents ("Swimming today at 4:30pm"), with
  neutral wording and an opt-out~~ (M6c)
- term re-enrolment: parents confirm next term's place in one tap, and the
  owner sees who is staying before the term starts
- ~~health notes (need to know)~~ (M6d)
- ~~custody and pickup restrictions~~ (M6d)
- ~~family data export and deletion~~ (M6d)
- backups check and data-breach response plan
- privacy summary for parents
- switching from another system: "we do the import" service, run alongside
  the school's current tool until they're ready. Before go-live we prove
  counts, active enrolments, credits and opening balances match the old
  system, and list anything that couldn't move. No paying twice while the
  old contract runs out, a rollback window, and one named person running it
- school data agreement (Ovyko handles the school's data only to run the
  service, keeps it in Australia, deletes it on request), a parent notice
  template for the move, and a privacy lawyer's review of both
- confirm every part of the service that touches personal data (database,
  app servers, email) runs in Australia, and pin it there
- pool-deck mode: instructors take attendance and progress with no Wi-Fi;
  it's kept on the device, shows what's waiting to send, and syncs safely
  when back online (no double marks, no lost changes)

Onboard one real provider only after these are in place.

## Ideas for after the pilot

Not scheduled. Revisit with the pilot school's feedback:
- waitlist that offers a permanent place to the next family automatically
- "ready for the next level" prompt and one-tap move up
- instructor cover when someone is sick
- calendar sync for parents (Apple, Google)
- end-of-term progress report parents can share
- private class notes between instructors
- owner home as exceptions: "3 things need you; everything else is handled"
- sibling finder: "a Level 4 class while Mia's class is on"
- activity packs (gymnastics next): the words and extras each activity needs
  on the shared engine (`docs/STRATEGY.md`)

## M7 — Payments

Only after operational loop is proven:
- a family ledger first: every charge, credit, refund and failed payment is a
  line with its reason, and the balance is worked out from them
- Stripe Connect
- payment schedules
- provider payouts
- receipts
- failed payment handling
