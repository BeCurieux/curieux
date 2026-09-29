# MAVYA v0.1 — Security and Privacy Plan

Mavya holds children's names, ages, schedules and, later, health and custody
details. Schools will trust it only if it is safer than the spreadsheets and
shared logins they use today. This file says what is already in place, what
is planned and in which milestone, and the checklist every new feature must
pass.

## Already in place (M0–M2)

- **Tenant isolation in the database.** Row level security on every table.
  Parents see only their own family, instructors only the children in classes
  they teach, owners only their own organisation. Composite
  `(organisation_id, id)` foreign keys stop rows pointing across
  organisations. Covered by `tests/rls/*`.
- **Individual logins.** Every person has their own account and role. There
  are no shared staff accounts.
- **Audit log.** Every insert, update and delete on tenant tables records who
  did it and when (`audit_events`).
- **Server-side rules.** Business rules and validation run on the server; the
  UI never decides who may see or change what.
- **Australian hosting.** The cloud database is in Sydney.

## Where apps in this category commonly fall short

Mavya should do better than the usual weaknesses of class-management software:

| Common weakness | Mavya's answer |
| --- | --- |
| Shared front-desk logins | Individual accounts only (in place) |
| Former staff keep access | Immediate staff removal (M2.5) |
| Owner account protected by a password alone | Two-step sign-in for owners (M6) |
| Parents can see other children on rosters or group messages | Roster privacy in every screen, email and text (M3–M5) |
| Health notes visible to every staff member | Need-to-know health notes (M6) |
| No way to record custody restrictions | Custody and pickup restrictions (M6) |
| Working With Children Checks tracked in spreadsheets | WWCC tracking with expiry reminders (later) |
| Family data export and deletion by support email | Self-serve export and deletion for owners (M6) |
| Child details in email subjects and lock-screen previews | Neutral notification wording (M3) |
| Migration by emailing spreadsheets | Import by upload; file deleted after import (M6) |
| Support staff with silent access to customer data | Audited, time-limited internal admin access (M6) |

## Plan by milestone

### M2.5 — Security hardening (straight after M2)

- **Leaked password protection.** Turn on Supabase Auth's check against known
  leaked passwords (dashboard setting).
- **Sign-in rate limits.** Review Supabase Auth rate limits; sign-in errors
  never say whether an email has an account.
- **Immediate staff removal.** An owner can remove a staff member. Their
  membership becomes `suspended`, access rules stop matching at once, their
  classes are left without an instructor, and their sessions are signed out.
  The removal is audited.

### M3 — Attendance and progress

- **Shared poolside devices.** Instructor sessions on shared tablets sign out
  after a period of inactivity.
- **Neutral notifications.** Emails and push messages never put a child's
  full name, health detail or location in the subject line or preview.
  Details are shown only after sign-in.
- **Photo consent.** If progress includes photos, each child has a consent
  setting and photos are never shown without it.

### M4 — Absences and make-ups

- **Roster privacy.** Make-up discovery shows available places, never the
  names of other children in a class.

### M5 — Fill Empty Spots

- **Vacancy privacy.** Vacancy offers never reveal which child is absent or
  why.
- **Claim links.** Links in offer messages expire, work once, and still require
  sign-in.

### M6 — Migration and pilot (before real children's data)

- **Two-step sign-in for owners.** Required for owners; optional for
  instructors and parents.
- **Parent invites.** Parents are invited by email and set their own
  password. Nobody else ever sees or sets a parent's password.
- **Health notes (need to know).** Allergies and medical notes are visible to
  the owner and the child's own instructors only, and every view is logged.
- **Custody and pickup restrictions.** A family can record who may not
  collect or contact a child. Instructors see a clear warning, not the court
  details.
- **Secure import.** CSV files are uploaded straight into Mavya, checked,
  imported and then deleted. No spreadsheets by email.
- **Export and deletion.** Owners can export a family's data and delete a
  family on request, as the Australian Privacy Act allows parents to ask.
  Deletions are audited.
- **Internal admin access.** Platform support can see a school's data only when
  the school grants access, for a limited time, and every action is audited.
- **Backups and breach response.** Confirm daily backups and point-in-time
  recovery on the cloud project. Write a short data-breach response plan
  (Notifiable Data Breaches scheme).
- **Privacy summary.** A plain-language page schools can share with parents:
  what is stored, where, who can see it, and how to ask for it to be deleted.

### Later

- **Working With Children Check tracking.** WWCC number and expiry per
  instructor, with reminders to the owner before expiry.
- **View logging.** Record who viewed a child's record, not only who changed it.
- **Error reporting hygiene.** When Sentry and PostHog are added, strip names,
  emails and child details before anything leaves Mavya.

## Checklist for every new feature

Before a feature is merged:

1. Every new table has row level security, and `tests/rls` proves a parent,
   an instructor and another organisation's owner cannot see or change what
   they shouldn't.
2. Every important change writes to the audit log.
3. No child's name, health detail or location appears in a notification
   subject, preview or URL.
4. No screen, email or text shows one family another family's children.
5. Permission checks happen on the server, never only in the UI.
6. New personal data is added to `docs/DATA_MODEL.md` and, from M6, to the
   privacy summary.
