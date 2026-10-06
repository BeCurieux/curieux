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
| **M8c** | **Free places offered to waiting families**: a place that frees up is offered to the longest-waiting family who asked for that time; they accept in one tap | The USP: empty places become fees, without the front desk |
| **M8d** | **A waiting-list page for new families**: the school links it from its own website; new families say what they'd like; the owner adds them in one tap | More families waiting means more places filled; demand data from beyond current families |
| **M8e** | **Families who might leave**: warning signs counted from the records, so the owner can call before a family quietly goes | The USP's "retain families": fees kept, not lost |

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
  enrolling (M8c).

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

## M8c — Free places offered to waiting families (done)

A family who asked for a time (M8b) is a waiting list. When a place comes
up at that time, the front desk today rings down a list. Ovyko offers it
for them. The defaults below were chosen by Claude on 5 October 2026; the
owner of Ovyko can change them.

### Decisions

1. **Offer, then the family accepts.** An offer is for one child, one
   class, and holds that place for **48 hours**. The family is emailed
   (neutral wording: the school and that a place has come up, never the
   child) and sees it on their home screen: "A place for Ava: Tuesdays at
   4:30pm, Level 2, Riverside", with **Yes, enrol** and **No thanks**.
   Accepting enrols the child by the normal rules and closes their
   request.
2. **Held places count.** While an offer is open, its place isn't free to
   anyone else: enrolling by hand, another offer or a check of places
   free counts it, so a class can't be over-filled.
3. **Automatic, if the school chooses.** A switch on "What families want":
   "Offer free places automatically". Off by default. When on, Ovyko checks
   every few minutes for classes with a free place and offers each to the
   **longest-waiting** open request that matches it: the same level (a
   request for "not sure" waits for the owner), a location it allows, a
   day it chose, and a start between its earliest and latest. A request
   isn't offered the same class twice, and a family needs a parent who has
   joined Ovyko to be offered anything.
4. **By hand, always.** Whether or not the switch is on, the owner can
   offer a place from "Places that match now" (as well as enrolling
   straight away, as in M8b), and withdraw an open offer.
5. **No thanks, or no answer.** Declining or letting it lapse leaves the
   request open (the family still wants a time) and, with the switch on,
   the place goes to the next family in line.
6. **Fees aren't added automatically.** As with any new enrolment, the
   owner adds the term's fee (Fees) when they choose; the family can pay
   online as usual.
7. **Recorded.** Offers, answers, withdrawals and the switch are audited.

### Data model

- New `PlaceOffer`: school, request, child, family, class, status
  (offered, accepted, declined, expired, withdrawn), offered by (null when
  automatic), expires at, answered at, the enrolment it became.
- `organisations.auto_place_offers` (default off).
- Email kind `place_offered`.

### Not in M8c

- New families joining a school's waiting list without an account
  (M8d).
- Places offered for a coming term rather than straight away.
- Charging for the term on accepting.

### Acceptance criteria

- The owner offers a matching place; the family sees it, accepts, and the
  child is enrolled; the request closes.
- While an offer is open, the place can't be taken by anyone else.
- Declining or letting an offer lapse frees the place; with the switch
  on, it goes to the next family in line, never the same class twice.
- With the switch on, a freed place is offered to the longest-waiting
  matching request; with it off, nothing is offered automatically.
- Other families, instructors and other schools can't see or answer an
  offer.

Tests: `tests/rls/place_offers.test.ts`, `tests/e2e/place-offers.spec.ts`.

## M8d — A waiting-list page for new families (done)

Most of a school's waiting list is families who aren't customers yet.
Today they ring, email or fill in a web form, and someone types them into
a spreadsheet. M8d gives each school its own page for that. It's the
school's page, linked from the school's own website: there's no directory
and no search across schools (CLAUDE.md rule 13). The defaults below were
chosen by Claude on 6 October 2026; the owner of Ovyko can change them.

### Decisions

1. **One page per school, off until the school turns it on**, from "What
   families want": "Waiting-list page for new families". The page's
   address is shown to copy (ovyko.com.au/waiting-list/<school>). When
   it's off, the address shows nothing about the school.
2. **What a family gives:** the parent's name, email and (optional)
   phone; the child's first and last name and date of birth; the level
   (or "not sure"), the days that work, the earliest and latest start, a
   location (or any), and a note. They tick that the school may keep these
   details to contact them about a place. The page names only the
   school's levels and locations.
3. **No account, and no email from Ovyko to the address given.** Anyone
   can type any address, so Ovyko doesn't email it automatically (it
   could be used to send mail to strangers). The family sees "Thanks,
   [school] will be in touch"; the school decides.
4. **The owner adds them in one tap.** "New families" on "What families
   want" lists each enquiry. **Add to the waiting list** makes the family
   (or finds it by email), the child (or finds them by name and date of
   birth) and their request for times, and invites the parent to Ovyko by
   email, as M6b. Once the parent joins, the request is offered places
   like any other (M8c). **Remove** deletes the enquiry.
5. **Kept only as long as needed.** An enquiry the school hasn't dealt
   with is deleted after 90 days. Once added, its details live on in the
   family's record, and the enquiry itself is deleted. Each enquiry is for
   one child; a family with two children sends it twice.
6. **Guarded against misuse.** A hidden field turns away simple bots; an
   email can have at most 3 open enquiries per school, and a school at most
   500. Only the school's owners can see enquiries.
7. **Recorded.** Turning the page on or off, adding and removing an
   enquiry are audited (without the family's details).

### Data model

- New `WaitlistEnquiry`: school, parent's name, email, phone; child's
  first and last name and date of birth; level, location, days, earliest
  and latest start, note; created at.
- `organisations.waitlist_page_on` (default off).

### Not in M8d

- Paying a deposit or a fee to join the list.
- Families choosing a class or time that has a place now (that's
  booking: later).
- A page listing several schools (a marketplace; not in v0.1).

### Acceptance criteria

- With the page on, anyone can send an enquiry for the school; with it
  off, the page says it isn't open and nothing is saved.
- Only the school's owners see enquiries; other schools, instructors and
  parents can't.
- Adding an enquiry makes the family, child and request (reusing a family
  with the same email), and invites the parent; the enquiry is gone.
- Removing an enquiry deletes it.

Tests: `tests/rls/waitlist_page.test.ts`, `tests/e2e/waitlist-page.spec.ts`.

## M8e — Families who might leave (done)

Families rarely say they're unhappy; they miss lessons, let credits run
out, stop answering, and then don't come back. The owner usually hears last.
Ovyko already has the records that show it. The defaults below were chosen
by Claude on 6 October 2026; the owner of Ovyko can change them. No AI:
fixed rules over the school's own records (CLAUDE.md rule 11).

### Decisions

1. **The warning signs**, for families with a child in a class (or paused):
   - a child has missed **3 or more lessons in the last 6 weeks**
     (reported away, or marked absent);
   - a child's **make-up credits ran out unused** in the last 8 weeks;
   - a child **isn't coming back next term** (answered "Not next term");
   - **no answer about next term** after the reply-by date;
   - fees **overdue by more than 2 weeks**;
   - a child's place is **paused**.
2. **One list, "Families who might leave"**, most warning signs first, each
   with its reasons in plain words ("Ava has missed 4 lessons in the last 6
   weeks") and the parent's phone and email to get in touch. Today shows
   how many, when there are any.
3. **Followed up.** The owner taps "Followed up", with a note if they like
   ("Called, Ava's had a cold"). The family leaves the list for 30 days;
   if the signs are still there after that, it comes back. Each follow-up
   is kept and audited.
4. **Only the school's owners** see the list. Families never see that
   they're on it.

### Data model

- New `RetentionFollowUp`: school, family, note (optional, up to 200
  characters), who, when.

### Not in M8e

- Messaging families from Ovyko (the owner calls or emails them).
- Weighting or scoring the signs, or predicting who will leave.

### Acceptance criteria

- A family with a child who missed 3 lessons in 6 weeks, or with fees
  overdue by more than 2 weeks, or who answered "Not next term", is on the
  list with those reasons; a family with none of the signs isn't.
- Marking a family followed up takes it off the list for 30 days and is
  recorded.
- Instructors, parents and other schools can't see the list or follow up.

Tests: `tests/rls/retention.test.ts`, `tests/e2e/retention.spec.ts`.
