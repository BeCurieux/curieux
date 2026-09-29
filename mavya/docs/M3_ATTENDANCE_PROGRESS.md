# M3 — Attendance and progress

## Goal

Make the instructor's two jobs real: take attendance for a lesson, and
update each child's skills. Parents see progress as soon as it is saved and
are told when their child achieves a skill. Instructor screens are safe on a
shared poolside iPad.

## Decisions

1. **Attendance belongs to a lesson.** An instructor marks each child *here*
   or *away* on one real lesson (a class occurrence), not on the class.
   The class page shows the lesson on now or most recently: attendance opens
   an hour before a lesson starts and can be corrected for 14 days after.
   A new class with no lesson yet shows when its first lesson is.
2. **Who may mark.** The class's own instructor and the organisation's
   owners. Only children enrolled in that class can be marked.
3. **One current status per skill.** Each child has one status per skill:
   not yet, developing or achieved. Every change is in the audit log with
   who made it, so the history is kept without a second table.
4. **Skills belong to a level.** Owners add and remove a level's skills in
   Settings → Programs & levels. An instructor updates a child's skills for
   the level of a class they teach the child in.
5. **Achievement notifications are in the app.** When a skill becomes
   achieved, each parent in the child's family gets a notification in
   Messages, with a dot on the Messages tab until they've seen it. Email and
   push delivery arrive with Resend (M6, alongside parent invites); their
   wording is written and tested now: the subject and preview never name the
   child, the skill or the place ("New progress update from Aqua House").
6. **Shared devices.** The instructor app signs out after 30 minutes without
   a tap, both in the browser (the screen goes back to sign-in by itself) and
   on the server (a later request is refused).
7. **No photos in v0.1.** Progress has no photos, so there is no photo
   consent yet. If photos are ever added, consent comes with them
   (`docs/SECURITY.md`).
8. **iPad layouts.** Instructor screens use the width of a tablet: classes and
   the roster in two columns, skills side by side.
9. **Still demo.** Absences, make-ups and vacancies stay the M1 demo overlay
   until M4–M5, so "Parent reported away" on the roster is still the demo.

## Scope

### Instructor

- Home: each class with its current lesson and how many are marked.
- Class: the lesson's date, a big here/away pair per child, a running count.
  Each child opens their skills.
- Child: the level's skills with not yet / developing / achieved, saved
  together, with a confirmation.

### Family

- Kids and each child's page show real progress for the level they're in:
  the ring, "3 of 5 skills achieved" and each skill's status.
- Messages lists achievement notifications, newest first; opening Messages
  marks them seen.

### Business (owners)

- Settings → Programs & levels: add and remove skills for each level.
- Class page: attendance for the current lesson.
- Progress: each level's children, and the children not assessed in the last
  four weeks.

## Rules and where they live

- `record_attendance` and `record_progress` are database functions. They
  check who is calling, that the child is in the class, that the lesson is
  open for marking and that the skill is at the child's level. The tables
  themselves can't be written directly.
- A trigger on progress creates the notifications, so no code path can
  achieve a skill without the family hearing about it.
- Every change to skills, attendance and progress writes an audit row.

## Not in M3

- Email and push delivery (M6, with Resend).
- Make-up children on the roster (M4).
- Photos, and a skill-by-skill history screen.
- Moving a child up a level.

## Acceptance criteria

### Security (RLS)

- Parents read only their own children's attendance, progress and skills,
  and their own notifications. They can't record anything.
- An instructor records attendance and progress only for children in classes
  they teach, and can't record another organisation's.
- An owner reads and records within their own organisation only.
- Nobody writes attendance, progress or notifications directly through the
  API.
- Attendance can't be recorded for a lesson more than an hour away, or more
  than 14 days ago, or for a child not in the class.

### Instructor path

1. Open the class; see the lesson date and the roster.
2. Mark a child here and another away; the count updates.
3. Open a child, set a skill to achieved and save; see the confirmation.
4. The child's family sees the new progress and a notification.

### Owner path

1. Add a skill to a level; it shows on the instructor's skills screen.
2. See attendance on the class page and assessment gaps on Progress.

### Shared devices

- An instructor who is idle for 30 minutes is signed out.
