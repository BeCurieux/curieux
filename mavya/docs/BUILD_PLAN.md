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

Implement:
- absence reporting
- policy configuration
- credit issuance
- eligibility service
- make-up discovery
- make-up booking
- roster privacy in make-up discovery

## M5 — Fill Empty Spots

Implement:
- temporary capacity
- candidate matching
- vacancy offer
- claim flow
- concurrency safety
- vacancy privacy and single-use claim links

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
- health notes (need to know)
- custody and pickup restrictions
- family data export and deletion
- backups check and data-breach response plan
- privacy summary for parents

Onboard one real provider only after these are in place.

## M7 — Payments

Only after operational loop is proven:
- Stripe Connect
- payment schedules
- provider payouts
- receipts
- failed payment handling
