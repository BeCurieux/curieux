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
| M6b | Getting set up: onboarding checklist, parent invites, two-step sign-in for owners | Parents can't use it until they're invited |
| M6c | Reaching families: email (and push) for offers, absences, reminders; lesson-day reminders with an opt-out | The engine is only automatic if families hear about it |
| M6d | Protecting children: health notes (need to know), custody and pickup restrictions, export and deletion | Must be in before real children's details |
| M6e | Term re-enrolment in one tap | Needed before the pilot's first term ends |
| M6f | Pool-deck mode (attendance without Wi-Fi) | Pilot feedback may reshape it |
| M6g | Support access (granted by the school, time-limited, audited) | Needed once the pilot asks for help |

Outside the code, and for the owner of Ovyko to do before a real school's
data arrives: Supabase Pro (backups, point-in-time recovery, leaked-password
check), confirm everything runs in Australia, an email-sending account
(Resend), the school data agreement and parent notice, and a privacy
lawyer's review.

## M6a — Moving a school in

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
