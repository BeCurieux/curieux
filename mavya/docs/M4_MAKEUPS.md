# M4 — Absences and make-ups

## Goal

Make the missed-lesson loop real. A parent reports an absence for a real
lesson, the school's make-up rules decide whether a credit is issued, and the
parent books a make-up into a real lesson with a free place. Instructors and
owners see who is away and who is coming as a make-up. An owner can cancel a
day's lessons (pool closure, weather) and every child gets a credit.

## Decisions

1. **Absences belong to a lesson.** A parent picks one upcoming lesson of a
   class their child is enrolled in. They can take it back ("We can make it
   after all") until the lesson starts, as long as the credit hasn't been used
   and their place hasn't been given to a make-up.
2. **Rules are the school's.** Each organisation has one active make-up
   policy (`docs/RULES_ENGINE.md`), edited in Settings → Make-up rules. Every
   change is a new version, so a credit is always judged by the rules it was
   issued under where that matters (its expiry is fixed when it's issued).
3. **When a credit is issued.** Only if make-ups are on, the absence is
   reported at least the policy's notice before the lesson, and the child has
   fewer than the policy's maximum available credits. Otherwise the absence
   is still recorded, so the instructor knows, and the parent is told why
   there's no credit.
4. **Where a make-up can go.** A lesson in the next `booking_horizon_days`,
   before the credit expires, not cancelled, at the child's level (or the next
   level up if the school allows it), not a class the child is already in, not
   clashing with another of the child's lessons, and with a free place.
5. **A free place** is capacity (or the lesson's own capacity) minus children
   enrolled, plus children reported away, minus make-ups already booked. The
   database checks it again, with the lesson locked, when a booking is
   confirmed, so two families can't take the last place.
6. **Cancelling a make-up.** With at least the policy's cancellation notice
   the credit comes back (if the school allows it and it hasn't expired);
   later than that it's used up.
7. **Roster privacy.** Make-up options show the class, time, level, place and
   instructor's first name, and how many places are free. Never another
   child's name, nor why a place is free.
8. **Cancelling a day.** An owner picks a location and a date. Every lesson
   there that day is cancelled; each enrolled child gets a credit (notice and
   maximum don't apply, it isn't their fault); make-ups booked into those
   lessons are cancelled with their credits returned; each family gets a
   notification in Messages.
9. **Make-up children on the roster.** The instructor sees them in the
   lesson's roster once it opens (an hour before, as in M3), marked
   "Make-up", and takes their attendance like anyone else's. The instructor
   can see their name for that reason only. The owner's class page shows
   who's coming as a make-up to the next lesson.
10. **Still demo until M5.** The candidate list on Fill Empty Spots and
    offering a spot to a family. The number of spots to fill is now real.

## Scope

### Family

- Home: "Can't make it?" for each child's next lesson; "make-up credit" and
  "make-up booked" cards when they apply.
- Can't make it: choose the lesson, optional reason, the school's rules in
  plain words, and whether a credit will be issued before confirming.
- Make-ups: each available credit with its options, best fit first (same time
  of day, closest to the missed lesson); pick and confirm; cancel a booking.
- Kids and Calendar: away lessons and booked make-ups for real. A child's
  page lists every upcoming lesson they're away from, each with "We can make
  it after all".

### Instructor

- The lesson's roster shows who the parents reported away and who is coming
  as a make-up.

### Business (owners)

- Settings → Make-up rules: turn make-ups on or off, notice, credit length,
  maximum credits, booking window, cancellation notice, same level or next
  level too.
- Settings → Cancel lessons: a location and a date.
- Class page: the next lesson's absences and make-ups.
- Today: real reported absences, credits expiring this week and spots to
  fill.

## Rules and where they live

- `report_absence`, `withdraw_absence`, `makeup_options`,
  `check_makeup`, `book_makeup`, `cancel_makeup`, `cancel_lessons` and
  `save_makeup_policy` are database functions. They check who is calling
  and apply the policy. The tables can't be written directly.
- `check_makeup` is the one eligibility check (`RULES_ENGINE.md`):
  `makeup_options` lists only the lessons it passes, and `book_makeup` runs it
  again inside the booking. The app never decides eligibility itself.
- Every absence, credit, booking, cancellation and policy change is audited.

## Not in M4

- Offering a freed place to a family, and claim links (M5).
- Email and push delivery (M6).
- Waitlists and permanent vacancies (later).

## Acceptance criteria

### Security (RLS)

- Parents read only their own children's absences, credits and bookings, and
  report or book only for their own children.
- Make-up options never include another child's details.
- Instructors see absences and make-ups for the lessons they teach only.
- Owners read and act within their own organisation only.
- The last place can't be booked twice, even at once.
- Nobody writes absences, credits, bookings or policies directly.

### Rules

- Notice, maximum credits, expiry, horizon, level, clash and capacity are each
  refused with a plain reason.
- A cancelled make-up returns its credit only with enough notice.
- Cancelling a day issues a credit to every enrolled child and returns
  make-up credits booked into it.

### Paths

1. A parent reports an absence, gets a credit and books a make-up; the
   instructor of that lesson sees the child as a make-up.
2. A parent cancels the make-up, then takes back the absence.
3. An owner changes the rules and they apply to the next absence.
4. An owner cancels a day's lessons; families see it and hold credits.
