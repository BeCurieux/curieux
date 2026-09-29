# OVIKO v0.1 — Rules Engine

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
  "waitlist_priority": "existing_students_first"
}
```

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
