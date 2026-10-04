# M8 — The network layer, first pieces

Goal: start building the moat in `docs/STRATEGY.md` ("The USP and the
moat"), inside the current rules. M8a makes the USP visible: what Ovyko did
for the school this month, in places and dollars. M8b starts layer 3, the
demand data: what families want and can't book, inside one school, with no
marketplace (CLAUDE.md rule 13). The defaults below were chosen by Claude
on 4 October 2026; the owner of Ovyko can change them.

| Slice | What | Moat layer |
|---|---|---|
| **M8a** | **This month with Ovyko**: places filled, fees collected, overdue fees chased and paid, families staying, jobs done without staff | The USP, made visible (layer 1 and 2) |
| **M8b** | **What families want**: families say which times they'd like; the owner sees new-class opportunities and places that match | Layer 3: demand data |

## M8a — This month with Ovyko (done)

### Decisions

1. **One page for owners**, "This month with Ovyko", with last month and
   earlier months a tap away, and a headline on Today.
2. **Only what Ovyko actually did, counted from records**, never guessed:
   - **Places filled**: make-ups taken in lessons this month, in places
     freed by absences; and their value at the school's own lesson prices
     ("worth $X"). It's the value of lessons delivered, not new income
     (the family had already paid), and the page says so.
   - **Fees collected through Ovyko**: online payments paid this month,
     and how many were instalments taken automatically.
   - **Overdue fees chased and paid**: payments made within 14 days after
     a fee reminder email.
   - **Families staying next term**: one-tap re-enrolment answers of
     "staying" this month.
   - **Jobs done without the front desk**: absences reported by parents,
     make-ups booked by parents, places offered automatically and claimed,
     online payments, reminder emails sent.
3. **Time saved is an estimate, and labelled as one**: minutes per job
   that a person would otherwise spend (absence 3, make-up booking 5,
   place offered and claimed 10, payment recorded 4, reminder chased 3,
   re-enrolment answer 4). Change them once the operator interviews give
   real numbers.
4. **The month is the school's month**, in its own time zone.

### Data model

No new tables: one read-only function for owners (`ovyko_month`).

### Acceptance criteria

- An owner sees this month's figures, and last month's; each one matches
  the records behind it.
- Jobs done by staff aren't counted as done by Ovyko.
- Instructors, parents and other schools can't see a school's figures.

## M8b — What families want (done)

### Decisions

1. **Families say what they'd like**, from their child's page: "Want a
   different time, or another class?" They choose the level (or "not
   sure"), the days that work, the earliest and latest start, and a
   location (or any). It's a request to their own school only; nothing is
   shared with any other provider.
2. **Owners see demand in one place**, "What families want":
   - **New class opportunities**: when 3 or more children want the same
     level, day and start time (to the half hour) at a location, and no
     class there has room, Ovyko says so: "Tuesday 4:30pm, Level 2,
     Riverside: 7 children would come." One tap opens a new class with
     those details filled in.
   - **Places that match now**: classes with room at a time a family
     asked for. One tap enrols the child; the family is emailed, and the
     request is marked as placed.
   - Every open request, newest first.
3. **A request stays open** until the child is placed, the parent
   withdraws it, or the child leaves the school. Placing a child in a
   class for that level closes their matching request.
4. **Enrolling from a request uses the normal rules**: capacity, clashes
   and the class's own checks still apply.
5. Families see their requests and can withdraw them.

### Data model

- New `PlaceWish`: school, family, child, level (or null for "not sure"),
  location (or null for any), the weekdays that work, earliest and latest
  start, a note (up to 200 characters), status (open, placed, withdrawn),
  the enrolment it became, who asked, when.
- An email to the family when their child is placed from a request.

### Not in M8b

- Demand across schools, matching families to other providers, "Build my
  term" (discovery; CLAUDE.md rule 13).
- Offering a place for the family to accept, rather than the school
  enrolling: later, with the permanent-waitlist work.

### Acceptance criteria

- A parent asks for times for their own child, sees it and can withdraw
  it; they can't for another family's child.
- The owner sees new-class opportunities from 3 or more matching children
  where no class has room, and none where one does.
- The owner enrols a child from a request into a class with room; the
  request closes and the family is emailed; a full class refuses.
- Instructors and other schools see no requests.

Tests: `tests/rls/m8.test.ts`, `tests/e2e/m8.spec.ts`,
`tests/unit/month.test.ts`. The owner's page is `/business/demand`, linked
from Today when there are requests; families ask from each child's page.
