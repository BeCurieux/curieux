# OVYKO v0.1 — Rules Engine

## Purpose

Rules must support different provider policies without hard-coding one swim school's behaviour.

The frontend must ask a server-side domain service whether an action is valid.

## Initial make-up policy schema

```json
{
  "makeups_enabled": true,
  "minimum_notice_minutes": 120,
  "credit_validity_days": 60,
  "max_active_credits": 2,
  "eligible_level_mode": "same_level",
  "allow_future_level": false,
  "booking_horizon_days": 14,
  "cancellation_notice_minutes": 120,
  "return_credit_on_valid_cancellation": true,
  "allow_temporary_vacancy_offers": true,
  "waitlist_priority": "existing_students_first",
  "auto_offer": true,
  "offer_hold_minutes": 120
}
```

`auto_offer` and `offer_hold_minutes` (15–1440) arrived in M5.5: when a
spot opens, the engine offers it to one family at a time, each holding it
for the hold time (or until 30 minutes before the lesson, if sooner). Who
goes first: families with a parent account, then the soonest-expiring
credit, then the earliest missed lesson. The rules above live in
`private.makeup_reasons`, used by both `check_makeup` and the engine.

## Required service

`evaluateMakeupEligibility(input)`

Input should include:

- organisation
- policy
- child
- source absence / credit
- target occurrence
- target class
- target level
- current enrolments
- current make-up bookings

Return:

```ts
type EligibilityResult = {
  eligible: boolean;
  reasons: string[];
  warnings?: string[];
}
```

## Initial rules

A booking is invalid when any of the following apply:

- make-ups disabled
- credit missing
- credit expired
- credit already redeemed
- target occurrence cancelled
- target occurrence outside booking horizon
- target class full
- target level incompatible
- child already has another booking/enrolment at same time
- organisation mismatch
- policy-specific maximum exceeded

## Concurrency requirement

The final place in an occurrence must not be claimable by two families.

Use a transaction / atomic capacity check when confirming a booking.

## Auditability

Every make-up booking and cancellation must create an audit event.
