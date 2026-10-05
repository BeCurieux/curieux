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

### M6d — Protecting children, part 2 (done)

- **Two-step sign-in, enforced in the database.** For a school that requires
  it (every school but the demo), the database's single owner check also
  requires the session to have passed two-step sign-in (Supabase Auth's
  assurance level 2). A stolen password alone reaches nothing, through the
  app or straight against the API. The app only sends the owner to enter
  the code. Codes come from an authenticator app (no SMS). Only Ovyko can
  turn the requirement off or remove a lost authenticator.
- **Export.** Owners only, by POST (a link or prefetch can't trigger it).
  Audited, and counted as a look at each child's health notes.
- **Deletion.** Owners only, confirmed by typing the family's name. Cascades
  to every record about the children; parents' accounts are removed by the
  server when they belong nowhere else; earlier audit entries about the
  family are wiped, and one entry with counts records the deletion.

### M6e — Term re-enrolment (done)

- Terms and questions are read-only to people: every change goes through a
  database function that checks the caller is the school's owner (or, to
  answer, a parent of that child) and that the term hasn't started.
- Parents see only their own children's questions, and only once the owner
  has asked. Instructors and other schools see none.
- Places offered for a move are counted, under a lock on the class, so a
  class can't be promised to more children than it holds.
- Emails name the school and the term only, never a child or a class, and
  are only sent while the family still has something to answer.
- Every term, question, offer, answer and outcome is audited, and the
  term-only switch too.

### M7a — Family accounts (done)

- Account lines are read-only to people and can't be changed by anyone: a
  database trigger refuses every update, so a mistake can only be
  cancelled by an opposite line, and both stay visible.
- Only the school's owners add lines, through functions that check the
  family is theirs; parents see only their own family's statement;
  instructors and other schools see none.
- Every line is audited; deleting a family removes its account and wipes
  it from earlier audit entries, as before.
- No money moves through Ovyko yet; card details will only ever be held by
  the payment provider (M7b).

### Ovyko's plan (done)

- Billing runs on Ovyko's own Stripe account; Ovyko never sees card or
  bank details. Only the server records a plan, from Stripe's own word
  (asked again, not taken from the message), and only for messages about
  Ovyko's own account: a school's subscriptions on its own Stripe account
  are ignored.
- Only a school's owners see or manage its plan. A billing problem never
  locks a school or its families out.

### Ovyko totals (done)

- Numbers across all schools only; no name of a school, family or child.
- Only people listed as platform admins (added in the SQL editor, never
  through the app), and only after two-step sign-in. Anyone else gets
  "not found".

### M7d part 1 — Government vouchers (done)

- Only owners turn a voucher into money off (a credit, at most the
  scheme's value); a parent can only hand one over, for their own child.
- A code can be handed over once per school; uniqueness isn't checked
  across schools, so one school can't learn another's vouchers.
- Owners and the family's parents see a family's vouchers; instructors
  and other schools see none. Audited.

### Founding-schools waitlist (done)

- The public form saves through one function that checks every field and
  requires consent to be emailed (Spam Act); the table itself can't be read
  or written by anyone through the app.
- Only platform admins, after two-step sign-in, see the list.
- No email is sent on sign-up: an open form that emails any address it's
  given could be used to send mail to strangers. A hidden field turns away
  simple bots.

### M8 — This month with Ovyko, and what families want (done)

- "This month with Ovyko" is for the school's owners only, and counts
  only the school's own records.
- A family's requests for other times go to their own school only; no
  other provider sees them (no marketplace, CLAUDE.md rule 13). Parents
  ask and withdraw for their own children only; owners see and act on
  their own school's requests; instructors see none. Audited.
- Families choose from their school's level and location names through a
  function that returns names only; the rules on what parents can read
  weren't widened.

### M6g — Support access (done)

- Ovyko support sees a school only after its owner lets them in, for 48
  hours (or until the owner ends it), and only after two-step sign-in.
- Support sees how the school is set up, never who is in it: no child,
  parent or family is named, and no health notes, restrictions, contact
  details or accounts are shown. Read only.
- Every look is an audit event the school's owners see on the same page;
  letting support in and ending it are audited too. Instructors and
  parents can't do either.

### M7c part 2 — Instalments (done)

- The card or bank account is saved by Stripe, on Stripe's own page, with
  the parent's agreement; Ovyko keeps only Stripe's reference to it, on
  the school's own Stripe account.
- Only the server takes later instalments, when the database's schedule
  calls it with `CRON_SECRET`; each is claimed once and charged once
  (Stripe's idempotency key is the payment's id).
- Stripe's messages about a payment the server took count only from that
  school's account, for that payment and amount; messages about a payment
  page are never taken for an instalment.
- Parents start plans only for their own family; nobody changes a plan or
  instalment directly. Schools opt in; the switch is audited, as are plans
  and instalments.
- A failed instalment is never retried behind the parent's back: the plan
  stops and the parent is emailed.

### M7c part 1 — Fee reminders (done)

- Reminder emails name the school and an amount, never a child, and are
  checked again just before sending, so a family that has paid, or has
  left, gets nothing.
- Schools opt in (they are emails to the school's customers); only owners
  switch it, and the switch is audited.

### M7b — Card and direct-debit payments (done)

- Card and bank details only ever go to Stripe, on Stripe's own page;
  Ovyko never sees or stores them.
- Each school is its own seller on its own Stripe account; families' money
  never passes through Ovyko's account.
- Stripe's messages are read only with a valid signature
  (`STRIPE_WEBHOOK_SECRET`). Even then a payment counts only if it comes
  from that school's own Stripe account, for the payment page Ovyko opened,
  for the amount Ovyko asked; repeats change nothing. A school's own Stripe
  account can't mark another school's family as paid.
- Only the server records a school's Stripe account and settles payments
  (functions only the secret key may call); parents can start paying only
  their own family's account; instructors see nothing.
- Online payment lines can't be cancelled in Ovyko, only refunded in
  Stripe, so an account can't claim money wasn't paid.
- Locally and in CI the app only ever talks to Stripe's test double.
- Reviewed on 4 October 2026 (`docs/M7_PAYMENTS.md`, "Review fixes"):
  no paying twice, messages that can't be lost or replayed out of order,
  and account changes read from Stripe itself.

### M6 — Migration and pilot (before real children's data)

- **Supabase Pro and leaked password protection.** Upgrade the cloud project
  to Pro (backups and point-in-time recovery need it too) and turn on
  Supabase Auth's check against known leaked passwords.
- ~~**Two-step sign-in for owners.**~~ Done in M6d. Optional for instructors
  and parents comes later.
- **Parent invites.** Parents are invited by email and set their own
  password. Nobody else ever sees or sets a parent's password.
- ~~**Health notes (need to know).**~~ Done in M6d.
- ~~**Custody and pickup restrictions.**~~ Done in M6d: the school records
  them (the person restricted may be a parent), instructors see a warning
  without the details.
- ~~**Export and deletion.**~~ Done in M6d.
- ~~**Internal admin access.**~~ Done in M6g.
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
- **Analytics stays off until its location is chosen.** PostHog has no
  Australian region, so there's no default host: analytics runs only when both
  a key and a host are set, and an overseas host must be named in the privacy
  policy first. Events carry no names, emails or child details either way.
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
