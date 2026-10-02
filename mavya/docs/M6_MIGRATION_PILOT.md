# M6 — Migration and pilot

## Goal

Get one real swim school running on Ovyko safely. Moving in has to be easy
("Give us your existing system. We'll move you", `docs/STRATEGY.md`,
must-have 7), parents have to be invited and reached outside the app, and
real children's data needs the protections in `docs/SECURITY.md` → M6
before it arrives.

M6 is too big for one pull request. It ships in slices, each one reviewable
and useful by itself, in this order:

| Slice | What | Why this order |
|---|---|---|
| **M6a** | **Moving a school in**: import classes and families from spreadsheets, check before saving, prove it matches, undo | Everything else needs the school's real data in |
| M6b | Getting set up: onboarding checklist, parent invites | Parents can't use it until they're invited |
| M6c | Reaching families: email (and push) for offers, absences, reminders; lesson-day reminders with an opt-out | The engine is only automatic if families hear about it |
| M6d | Protecting children: two-step sign-in for owners, health notes (need to know), custody and pickup restrictions, export and deletion | Must be in before real children's details |
| M6e | Term re-enrolment in one tap | Needed before the pilot's first term ends |
| M6f | Pool-deck mode (attendance without Wi-Fi) | Pilot feedback may reshape it |
| M6g | Support access (granted by the school, time-limited, audited) | Needed once the pilot asks for help |

Outside the code, and for the owner of Ovyko to do before a real school's
data arrives: Supabase Pro (backups, point-in-time recovery, leaked-password
check), confirm everything runs in Australia, an email-sending account
(Resend), the school data agreement and parent notice, and a privacy
lawyer's review.

## M6a — Moving a school in (done)

### Decisions

1. **Two spreadsheets, in the school's words.** A classes file (one row per
   class) and a students file (one row per child, with a parent's contact
   and, if they have one, their class). Column names are forgiving
   ("First name", "first_name", "Child first name"). Owners download blank
   templates with an example row. CSV only; every system can export it.
2. **Check first, save second.** Uploading shows what would happen: how
   many classes, families, children and enrolments would be added, what's
   already in Ovyko, and every row that can't come across, with the row
   number and the reason in plain words. Nothing is saved until the owner
   confirms.
3. **All or nothing.** Confirming saves everything in one database
   transaction, or nothing. A half-imported school is worse than none.
4. **Safe to run again.** Rows that match what's already in Ovyko are
   skipped, not duplicated: a class by name, day, start time and location;
   a family by parent email (else phone); a child by family, first name and
   date of birth. So the school can keep using its old system and import
   again before go-live to pick up newcomers.
5. **Set-up comes first.** Locations and levels must already exist (they're
   quick to add and the owner should choose them); the import matches them
   by name and says which are missing. Instructors are matched by email to
   staff already added; an unknown instructor leaves the class unassigned,
   with a note.
6. **Prove it matches.** After saving, the import's page shows the counts
   from the files next to the counts now in Ovyko, and the rows that didn't
   move, so the owner can check against the old system before go-live.
7. **Undo, for a while.** An import can be undone for 14 days, as long as
   nothing has happened to what it added (no attendance, absences,
   progress, make-ups or offers). Undo removes exactly what that import
   added.
8. **Recorded.** Each import is kept (who, when, files' names, counts) and
   every row it adds is audited like any other change. The files
   themselves aren't kept: they're read, checked and discarded.
9. **Server-side rules.** The app only reads the CSV into rows. Matching,
   checks and saving happen in one database function (`import_school`),
   which only the school's owners can call.

### Data model

- New `ImportBatch`: id, organisation_id, created_by, created_at,
  file names, counts (json), problems (json), undone_at nullable.
- `import_batch_id` (nullable) on classes, families, children and
  enrolments: what an import added, so undo removes exactly that.

### Not in M6a

- Attendance history, progress history, balances, credits and waitlists
  from the old system (next, once we've seen the pilot school's export).
- Connectors that pull straight from iClassPro, SimplySwim and others.
- Updating existing records from a file (only adding).

### Acceptance criteria

- An owner uploads a classes file and a students file, sees what will be
  added and every problem row, and nothing is saved until they confirm.
- Confirming adds the classes (with their lessons), families, children and
  enrolments, and shows file counts next to Ovyko's counts.
- Importing the same files again adds nothing.
- A file with a missing level, a bad date or a full class names each row
  and reason; the rest can still be imported.
- Undo removes what the import added; it's refused once anything has
  happened to it.
- Instructors, parents and other schools' owners can't import or see
  imports.

## M6b — Getting set up (done)

### Decisions

1. **Invite links, emailed later.** An owner invites a parent from the
   family's page (the email from the import is filled in). Ovyko makes a
   link the owner can copy and send by email or text. Until email arrives
   (M6c), Ovyko doesn't send it itself; then the same invite goes out by
   email automatically.
2. **One link, one family, one email.** A link works for 14 days, once, and
   only for the email it was made for: the person joining must sign in or
   create an account with that email. A new invite for the same email
   replaces the old one; the owner can cancel an invite. The database keeps
   only a hash of the code, as with claim links (M5).
3. **Joining takes one step.** A parent new to Ovyko opens the link, sees the
   school and family they're joining, types their name and a password, and
   lands on their family's Home. Sign-up stays closed to everyone else: the
   account is created by the server only for a valid invite. A parent who
   already has an Ovyko account (at another school, say) signs in and taps
   Join, and sees both schools with one login.
4. **The checklist.** Until a school is set up, Today starts with what's
   left: locations, levels, make-up rules, classes and families (Move your
   school in), and inviting parents. Each step opens the page that
   does it, and it disappears once everything's done.
5. **Recorded.** Invites, cancellations and joins are audited.

### Data model

- New `FamilyInvite`: id, organisation_id, family_id, email, code_hash,
  status (pending | accepted | revoked), invited_by, created_at,
  expires_at, accepted_by nullable, accepted_at nullable.
- `family_parents`: owners see the name and email of each family's
  parents, without reading parents' accounts directly.

### Not in M6b

- Sending invites by email, and inviting every family at once (M6c).
- Two-step sign-in for owners (M6d).
- Inviting instructors (owners can't add staff yet; the same kind of link
  will do it, next).

### Acceptance criteria

- An owner invites a parent and gets a link; a new parent opens it, sets a
  password and sees their children.
- A parent with an account at another school joins with the same login.
- A link used, cancelled, replaced, expired, or opened with another
  account's email does nothing.
- Only the school's owners can invite, see or cancel its invites.
- Today shows what's left to set up, and each step links to where it's done.

## M6c — Reaching families (done)

### Decisions

1. **Email first, push later.** Families hear by email when a spot is
   offered to them, a lesson is cancelled, a skill is achieved, and when the
   school invites them. Push needs the app installed on a phone; it waits
   for after the pilot.
2. **Neutral wording, everywhere outside the app.** Subjects and previews
   never name a child, a skill, a health detail or a place
   (`docs/SECURITY.md`). Emails say what happened at which school and link
   into Ovyko, where the details are, after sign-in.
3. **Lesson-day reminders.** At 7am on a lesson day, each parent gets one
   email listing the day's lessons ("Swimming today at 4:30pm"), leaving out
   children reported away and cancelled lessons, adding booked make-ups.
   Every reminder says how to turn them off; Account has the switch. Offers,
   cancellations and invites are service messages and always go.
4. **An outbox in the database.** Every email to send is a row, created by
   the database when the thing happens (or by the 7am job). A sender in the
   app delivers them every minute, retrying a few times, and never sends
   one twice. Emails more than a day late are skipped, not sent.
5. **Off until switched on.** Without an email service set up, nothing is
   sent and nothing piles up: deliveries are marked skipped. Locally and in
   tests, emails go to the test mailbox.
6. **Invites by email.** Making an invite link also emails it, when email is
   on; the owner can still copy the link.

### Data model

- `users.lesson_reminders` (default on), changed only by the person.
- New `EmailDelivery`: kind, recipient, organisation, notification
  (nullable), payload (ids only), status (pending | sending | sent |
  failed | skipped), attempts, next attempt, sent at, error, provider id.
  Only the server's sender can read or change it.

### Not in M6c

- Push notifications, SMS, and email for owners and instructors.
- Inviting every family at once (next).

### Acceptance criteria

- A spot offered, a lesson cancelled and a skill achieved each send one
  neutral email to each parent in the family, linking into Ovyko.
- An invite is emailed with its link.
- A parent with a lesson today gets one 7am reminder; none for a child
  reported away or a cancelled lesson; none after turning them off.
- No email is sent twice, and none when email isn't set up.
- Nobody but the server can read or change the outbox.

## M6d — Protecting children (done)

Ships in two parts. **Part 1 (done):** health notes and pickup
restrictions. **Part 2 (done):** two-step sign-in for owners, and exporting
or deleting a family's data.

### Decisions (part 1)

1. **Health notes, need to know.** Allergies and medical notes for a child,
   written by the child's parents or the school's owners. Read by the
   child's parents, the school's owners, and the instructors who teach the
   child (their classes, or a make-up in one). Nobody else, and never
   another school.
2. **Pickup and contact restrictions.** Owners record who may not collect
   or contact a child, with private details (a court order, say).
   Instructors see the name and what's not allowed, as a clear warning,
   never the details. Parents don't see restrictions in the app: the
   person restricted may be a parent with an account.
3. **Every look is recorded.** Health notes and restrictions can't be read
   from the tables at all; one function returns them, and records each time
   staff open them. Owners see who looked, and when, on the child's page.
   Rosters only show a flag that there's something to know.
4. **Changes are audited** like everything else.

### Data model

- New `ChildHealth` (one per child): allergies, medical notes, updated
  by and when.
- New `ChildRestriction`: person's name, kind (no_collect | no_contact),
  details (owners only), added by and when, removed at.
- New `SensitiveView`: who looked at which child's health and safety
  details, and when.

### Acceptance criteria

- A parent adds an allergy; the child's instructor sees it from the roster,
  and the owner sees that the instructor looked.
- An instructor who doesn't teach the child, another school's staff, and
  other families see nothing.
- An owner adds a restriction; the instructor sees the warning without the
  details; the child's parents don't see it.
- Changes are audited without the notes' content.

### Decisions (part 2)

1. **Two-step sign-in for owners.** An owner signs in with their password
   and then a 6-digit code from an authenticator app (Google Authenticator,
   1Password, Microsoft Authenticator). The first time, Ovyko shows a QR
   code to scan. No text messages: they can be intercepted, and cost money.
2. **Enforced by the database, not just the screens.** Until the code is
   entered, the database treats the person as not an owner at all, so a
   stolen password used straight against the API sees nothing. Instructors
   and parents aren't asked (optional for them later).
3. **On for every school, except the demo.** A new school has it on. The
   demo schools, whose shared logins prospects try, have it off; that's a
   setting on the school only Ovyko can change.
4. **A lost phone goes through Ovyko.** There's no self-serve reset (it
   would be the weak spot). Ovyko checks who's asking and removes the old
   authenticator; the owner sets up a new one at their next sign-in.
5. **Export a family.** On a family's page, an owner downloads everything
   Ovyko holds about that family as one file: contact details, parents who
   joined, children, classes, attendance, progress, absences, make-ups,
   offers, health notes and restrictions. It's recorded in the audit trail,
   and as a look at each child's health notes.
6. **Delete a family, on request.** The owner types the family's name to
   confirm. The family, its children and everything about them go at once,
   and can't be brought back. Parents' accounts go too, unless they belong
   to another family or work at a school. The audit trail keeps that a
   deletion happened, by whom and when, with the family's details wiped
   from its earlier entries.

### Data model (part 2)

- `organisations.owner_two_step_required` (default on; off for the demo
  schools).
- Audit events gain the action `export`.

### Acceptance criteria (part 2)

- An owner of a school that requires it is asked to set up an authenticator
  at their first sign-in, and for a code at every sign-in after.
- Before the code, the database gives that owner nothing of the school's.
- An owner downloads a family's data; it's audited; nobody else can.
- An owner deletes a family by typing its name: its children, their records
  and parents' accounts with nothing else go; the audit trail no longer
  holds their details; nobody else can.

## M6e — Term re-enrolment (draft: decisions pending)

Most swim schools sell lessons by the school term. Before a term ends they
ask every family whether they're staying, chase the ones who haven't
answered by phone, and only then know which places are free for newcomers.
M6e makes that one tap for parents and one screen for the owner.

### Proposed decisions

1. **Terms.** An owner adds the school's terms: a name ("Term 1 2027"),
   first and last day. Terms are per school, since not every school follows
   state school terms.
2. **Asking families.** For the next term, the owner sets a reply-by date
   and taps "Ask families". Each child's current classes become a question
   for their parents: "Keep Ava's place in Dolphin 3, Wednesday 4:30pm, for
   Term 1 2027?" Yes or No, one tap each, in the app and by email (neutral
   wording, as M6c).
3. **The owner's view.** Per class: staying, leaving, not answered yet, and
   the places that will be free next term. A reminder can be re-sent to
   those who haven't answered.
4. **Leaving.** A "No" ends the enrolment on the term's last day. The place
   it frees shows as open for next term, ready for M5's fill-the-spot and
   for newcomers.
5. **Recorded.** Asks, answers and changes are audited like everything else.

### Questions for the owner of Ovyko

1. **Holidays.** Does the pilot school stop lessons in the school holidays,
   so Ovyko only schedules lessons inside term dates? Or run all year, with
   "term" only marking when families re-confirm?
2. **No answer by the deadline.** Keep their place (fewer accidental
   drop-outs; recommended) or free it (more certainty)? Could be the
   owner's choice each term.
3. **Moving up a level.** Should the owner be able to offer a different
   class in the same ask ("Ava's ready for Dolphin 4, Wednesday 5pm")? Valuable,
   but it roughly doubles the slice; it could follow as M6e part 2.
4. **Timing.** Default: ask 3 weeks before the term ends, reply by 1 week
   before. Right for the pilot school?

### Not in M6e

- Payment for the new term (payments come with Stripe Connect, later).
- Waitlists and enrolling newcomers into the freed places (after the pilot
  shows how schools want it).
