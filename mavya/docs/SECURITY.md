# OVYKO v0.1 — Security and Privacy Plan

Ovyko holds children's names, ages, schedules and, later, health and custody
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

Ovyko should do better than the usual weaknesses of class-management software:

| Common weakness | Ovyko's answer |
| --- | --- |
| Shared front-desk logins | Individual accounts only (in place) |
| Former staff keep access | Immediate staff removal (M2.5) |
| Owner account protected by a password alone | Two-step sign-in for owners (M6) |
| Parents can see other children on rosters or group messages | Roster privacy in every screen, email and text (M4–M5) |
| Health notes visible to every staff member | Need-to-know health notes (M6) |
| No way to record custody restrictions | Custody and pickup restrictions (M6) |
| Working With Children Checks tracked in spreadsheets | WWCC tracking with expiry reminders (later) |
| Family data export and deletion by support email | Self-serve export and deletion for owners (M6) |
| Child details in email subjects and lock-screen previews | Neutral notification wording (in place) |
| Migration by emailing spreadsheets | Import by upload; file deleted after import (M6) |
| Support staff with silent access to customer data | Audited, time-limited internal admin access (M6) |

## Plan by milestone

### M2.5 — Security hardening (done)

- **Leaked password protection.** Moved to M6: Supabase offers it only on
  the Pro plan, and the project is on Free while it holds only demo accounts.
- **No open sign-up.** Accounts are created by Ovyko, never by strangers:
  sign-up is off in `supabase/config.toml` and must be off on the cloud
  project too. Parents will be invited in M6.
- **Sign-in limits.** Sign-in runs on the server, so Supabase Auth's own
  per-address limit sees the server's address, not the person's. Ovyko counts
  failed attempts itself: five for one email, or fifty from one address, in
  fifteen minutes pause sign-in for fifteen minutes. The answer is the same
  whether or not the email has an account, and emails are stored only as a
  hash (`private.sign_in_failures`, cleared after a day). Only the server can
  read or reset the counts.
- **Immediate staff removal.** Settings → Staff. Removing someone suspends
  their membership, takes them off their classes and ends their sessions in
  one database function (`remove_staff_member`). Access stops at once because
  every access rule and the app's role lookup only count active memberships.
  Owners can't remove themselves, and can give access back. Staff changes are
  audited.

### M3 — Attendance and progress (done)

- **Shared poolside devices.** The instructor app signs out after 30 minutes
  without a tap. The browser goes back to sign-in by itself, and the server
  refuses an instructor request that arrives after the limit
  (`src/lib/auth/idle.ts`). Parents and owners aren't affected.
- **Neutral notifications.** Emails and push messages never put a child's
  name, a skill, health detail or a location in the subject line or preview:
  they say "New progress update from Aqua House", and details are shown only
  after sign-in (`outboundMessage` in `src/lib/domain/notifications.ts`,
  used when delivery arrives in M6). Stored notifications hold ids, not
  names, and each person can read only their own.
- **Attendance and progress writes.** Only through database functions that
  check the caller teaches the class (or owns the organisation), the child
  is in it, and the lesson is open. The tables can't be written directly.
- **Photo consent.** Not needed yet: progress has no photos in v0.1. If
  photos are added, each child gets a consent setting and photos are never
  shown without it.

### M4 — Absences and make-ups (done)

- **Roster privacy.** Make-up discovery shows the class, time, level, place,
  instructor's first name and number of free places, never the names of
  other children in a class or why a place is free (`makeup_options`).
- **Writes only through the rules.** Absences, credits, bookings and make-up
  policies can't be written directly; database functions check the caller
  acts for the child (their parent, or the owner) and apply the school's
  policy. Every change is audited.
- **The last place goes once.** Booking locks the credit and the lesson and
  checks eligibility again, so two families can't take the same place.
- **Instructors see make-up children** only for lessons they teach, recently
  or soon, so they can take attendance.

### M5 — Fill Empty Spots (done)

- **Vacancy privacy.** An offer shows the lesson (class, time, level, place,
  instructor's first name), never which child is away or why. Candidate
  lists are for the school's owners only.
- **Claim links.** `/family/claim/<code>`: 256 random bits, of which the
  database keeps only a SHA-256 hash. A link works only signed in, only for
  the offer's own family, only once, and only until it expires (24 hours or
  the lesson's start). A wrong or someone else's code shows nothing.
- **The last spot goes once.** Claiming locks the lesson and books through
  `check_makeup`, like any make-up; the lesson's other offers then close.
- **Instructor clash check.** A database trigger refuses a class that puts
  its instructor in two classes at once, whatever path saves it.

### M5.5 — Automatic offers (done)

- **Same guarantees, no caller.** The engine runs inside the database
  (triggers and a five-minute `pg_cron` job) as private functions nobody
  can call through the API. It applies the same rules as `check_makeup`
  (one shared function), and claiming still goes through `claim_offer`.
- **Only families who can answer.** Offers go only to families with a
  parent account, never more open offers than the child has credits, and
  never to the child who is away.
- **Visible and reversible.** Automatic offers have no `offered_by`, show as
  "Offered automatically" to the owner, are audited, and stop when the
  owner turns the rule off.

### M6a — Moving a school in (done)

- **Files aren't kept.** CSV files are uploaded straight into Ovyko, read,
  checked and discarded; only their names and the import's counts and
  problem rows are stored. No spreadsheets by email.
- **Owners only.** Only the school's own owners can check, import, see or
  undo imports; everything is checked again in the database when saving.
- **Nothing half-done.** An import saves in one transaction or not at all.
- **Undo can't reach further than the import.** Only the import function
  can mark a row as imported, so undo deletes exactly what that import
  added, and refuses once anything depends on it.

### M6b — Getting set up (done)

- **Sign-up stays closed.** An account is created only by the server, for a
  valid invite, with the email the invite was made for. Everyone else is
  refused.
- **Invite links.** 256 random bits, only a hash kept; each works once, for
  14 days, for one email, and can be cancelled or replaced. The page a link
  opens shows the school, the family's name and the email, never the
  children.
- **The school vouches for the email.** Until invites are emailed (M6c),
  the owner sends the link themselves, so the account is marked confirmed
  on the school's word; whoever holds the link can join as that email.
  Owners should send links only to the parent's own email or phone.
- **Owners see who joined, not their accounts.** Name and email of a
  family's parents, through one function; parents' accounts stay private.
- **Sign-in only sends people on to an invite.** The `next` parameter
  accepts nothing but an invite link, so it can't be used to redirect
  elsewhere.

### M6c — Reaching families (done)

- **Neutral emails.** Subjects and previews never name a child, a skill, a
  health detail or a place; the email says what happened at which school and
  links into Ovyko, where the details are after sign-in.
- **The outbox is the server's.** Nobody signed in can read or change it.
  The sender is an app route that answers only to `CRON_SECRET`, which the
  database's schedule keeps in Vault.
- **Built at sending time.** An email is built from the database as it is
  then: an offer already taken, a lesson since cancelled or a child since
  reported away isn't emailed. Each email is handed out once.
- **Off by default.** Without an email service configured, nothing is sent.

### M6d — Protecting children, part 1 (done)

- **Need to know.** Health notes reach the child's parents, the school's
  owners and the instructors who teach the child (their classes, or a
  make-up in one), never another school or another family.
- **No direct reads.** The tables are closed to everyone signed in; one
  function returns what each person may know and records every look by
  staff. Owners see who looked and when. Rosters show only a flag.
- **Restrictions protect against parents too.** Owners record them;
  instructors see the name and the warning, never the details; parents
  don't see them at all, not even that one exists.
- **Audited without the content.** Changes are in the audit trail, which
  says the notes changed, not what they say, so the trail isn't a way
  around the view log.

### M6 — Migration and pilot (before real children's data)

- **Supabase Pro and leaked password protection.** Upgrade the cloud project
  to Pro (backups and point-in-time recovery need it too) and turn on
  Supabase Auth's check against known leaked passwords.
- **Two-step sign-in for owners.** Required for owners; optional for
  instructors and parents.
- **Parent invites.** Parents are invited by email and set their own
  password. Nobody else ever sees or sets a parent's password.
- ~~**Health notes (need to know).**~~ Done in M6d.
- ~~**Custody and pickup restrictions.**~~ Done in M6d: the school records
  them (the person restricted may be a parent), instructors see a warning
  without the details.
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
- **View logging.** Record who viewed a child's record, not only who changed it
  (done for health notes and restrictions in M6d).
- **Error reporting hygiene.** When Sentry and PostHog are added, strip names,
  emails and child details before anything leaves Ovyko.

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
