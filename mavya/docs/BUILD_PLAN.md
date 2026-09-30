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

## M6 — Migration and pilot

Implement:
- CSV family import
- CSV children import
- CSV class import
- onboarding checklist
- minimal internal admin support (granted by the school, time-limited, audited)
- Supabase Pro, with leaked password protection on
- two-step sign-in for owners
- parent invites
- email and push delivery of notifications, with the neutral wording from M3
- lesson-day reminders to parents ("Swimming today at 4:30pm"), with neutral
  wording and an opt-out
- term re-enrolment: parents confirm next term's place in one tap, and the
  owner sees who is staying before the term starts
- health notes (need to know)
- custody and pickup restrictions
- family data export and deletion
- backups check and data-breach response plan
- privacy summary for parents
- switching from another system: "we do the import" service, run alongside
  the school's current tool until they're ready
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

## M7 — Payments

Only after operational loop is proven:
- Stripe Connect
- payment schedules
- provider payouts
- receipts
- failed payment handling
