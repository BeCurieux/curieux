# MAVYA v0.1 — Build Plan

## Principle

Build in gates.

Do not start a later milestone until current acceptance criteria pass.

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

## M3 — Attendance and progress

Implement:
- attendance
- skills
- progress assessment
- parent progress display
- achievement notifications

## M4 — Absence and make-up engine

Implement:
- absence reporting
- policy configuration
- credit issuance
- eligibility service
- make-up discovery
- make-up booking

## M5 — Fill Empty Spots

Implement:
- temporary capacity
- candidate matching
- vacancy offer
- claim flow
- concurrency safety

## M6 — Migration and pilot

Implement:
- CSV family import
- CSV children import
- CSV class import
- onboarding checklist
- minimal internal admin support

Onboard one real provider.

## M7 — Payments

Only after operational loop is proven:
- Stripe Connect
- payment schedules
- provider payouts
- receipts
- failed payment handling
