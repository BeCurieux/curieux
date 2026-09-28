# MAVYA v0.1 — Data Model

## Core entities

### User
- id
- auth_id (references Supabase `auth.users`; the row is created on sign-up)
- name
- email
- phone
- created_at

### Organisation
- id
- name
- slug
- activity_type
- timezone
- status: active | suspended
- created_at

### Location
- id
- organisation_id
- name
- address fields
- timezone

### StaffMembership
- id
- user_id
- organisation_id
- role: owner | instructor
- status: invited | active | suspended

Unique per (user_id, organisation_id). Only `active` grants access.

### Family
- id
- display_name
- created_at

### FamilyMember
- id
- family_id
- user_id
- relationship
- is_primary_guardian

Unique per (family_id, user_id). At most one primary guardian per family.

### Child
- id
- family_id
- first_name
- last_name
- date_of_birth
- avatar_url nullable
- active

### Program
- id
- organisation_id
- name
- type
- active

### Level
- id
- program_id
- name
- sort_order
- active

### Skill
- id
- level_id
- name
- description nullable
- sort_order
- active

### Class
Represents the recurring class template.

- id
- organisation_id
- location_id
- program_id
- level_id
- instructor_id nullable
- name
- weekday
- start_time
- duration_minutes
- capacity
- active

### ClassOccurrence
Represents a real scheduled occurrence.

- id
- class_id
- starts_at
- ends_at
- capacity_override nullable
- status: scheduled | cancelled | completed
- created_at

### Enrolment
Permanent/ongoing class enrolment.

- id
- child_id
- class_id
- status: active | paused | ended
- starts_at
- ends_at nullable

### Attendance
- id
- child_id
- occurrence_id
- status: present | absent | makeup
- recorded_by
- recorded_at

### ProgressRecord
- id
- child_id
- skill_id
- status: not_started | developing | achieved
- assessed_at
- assessed_by

### Absence
- id
- child_id
- occurrence_id
- reported_at
- reason nullable
- make_up_eligible boolean
- created_by

### MakeupCredit
- id
- child_id
- source_absence_id
- issued_at
- expires_at
- status: available | redeemed | expired | revoked

### MakeupBooking
- id
- credit_id
- child_id
- target_occurrence_id
- status: booked | cancelled | completed
- booked_at

### WaitlistEntry
- id
- child_id
- organisation_id
- program_id nullable
- level_id nullable
- class_id nullable
- priority
- status

### PolicySet
- id
- organisation_id
- policy_type
- config_json
- version
- active

### Notification
- id
- recipient_user_id
- organisation_id nullable
- type
- payload_json
- status
- sent_at nullable
- read_at nullable

### AuditEvent
- id
- actor_user_id nullable
- organisation_id nullable
- action
- entity_type
- entity_id
- before_json nullable
- after_json nullable
- created_at

## Important modelling rules

1. `Class` is the recurring pattern.
2. `ClassOccurrence` is the actual real-world lesson.
3. Make-up bookings never mutate the child's permanent enrolment.
4. Temporary vacancy is derived from occurrence state, absences and make-up bookings.
5. Rules must be organisation-scoped.
6. Family and organisation boundaries must be enforced with RLS.
7. Cross-provider child identity is deliberately deferred.
