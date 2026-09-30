# M5 — Fill Empty Spots

## Goal

Turn an absence into a filled place. When a child is away, their place in
that lesson is free for a make-up. The owner sees each open spot with the
children who hold a make-up credit and fit it, offers the spot, and the
family claims it in one tap. The owner sees what it added up to: make-ups
delivered in places that would have sat empty, without extra classes.

From the market research (September 2026), M5 also brings three things
competitors already do or that make the numbers trustworthy: a preview
before cancelling a day, every number on Today opens to the records behind
it, and a warning when an instructor would be in two places at once.

## Decisions

1. **An open spot** is a place in a lesson in the next 7 days that an
   absence freed and no make-up has taken:
   `min(absences − make-ups booked, free places)`, never below zero. Today
   and Fill Empty Spots count the same thing.
2. **Candidates** are children at the same school holding an available
   make-up credit that `check_makeup` (M4) says can be used for that lesson.
   The database finds them; the app never decides eligibility. Soonest-
   expiring credit first, so credits get used before they lapse.
3. **An offer is an invitation, not a hold.** The owner can offer one spot
   to several families; the first to claim it gets it. Claiming runs the
   same locked booking as a make-up, so the last place can't go twice. When
   a lesson has no spots left, its other open offers close as "filled".
4. **Offers expire** after 24 hours or when the lesson starts, whichever is
   first. A family can say "No thanks".
5. **Claim links** (`/family/claim/<code>`) are for the offer's own family only:
   they need sign-in, work once, and stop working when the offer is
   claimed, declined, filled or expired. The database keeps only a hash of
   the code; the code itself is only in that family's notification, and in
   the email that M6 sends.
6. **Vacancy privacy.** An offer shows the class, day, time, level, place and
   instructor's first name. Never which child is away or why.
7. **The tally** on Today covers the last 12 weeks: make-ups delivered (in
   lessons that have started) and families whose child didn't miss out.
   Schools charge by the term, so it isn't shown as money. A dollar figure
   waits until a school sells casual places.
8. **Preview before cancelling a day.** Settings → Cancel lessons first shows
   how many lessons, children and families it affects, how many credits it
   will issue and how many booked make-ups it will cancel. Nothing changes
   until the owner confirms.
9. **Every number opens.** Each figure on Today links to the list it counts,
   with the rule it's counted by in plain words.
10. **Instructor clash check.** Saving a class that would put its instructor
    in two classes at the same time on the same day (at any location) is
    refused, naming the other class. Occurrence-level cover (sick days)
    stays in "Ideas for after the pilot".

## Scope

### Business (owners)

- Fill Empty Spots: each open spot with its real candidates; offer a spot;
  see who has been offered and whether they claimed.
- Today: the tally; every stat opens to its records.
- Settings → Cancel lessons: preview, then confirm.
- Classes: the clash check when saving.

### Family

- Home and Messages: "A spot opened for Ava: Thursday 4:30pm".
- The offer page: the lesson, "Claim this spot" or "No thanks"; a clear
  message when it's gone, expired or already claimed.

## Rules and where they live

- `open_spots`, `vacancy_candidates`, `offer_spot`, `offer_details`,
  `claim_offer`, `decline_offer`, `preview_cancel_lessons` and
  `fill_tally` are database functions. They check who is calling.
- Offers can't be written directly. Every offer, claim and decline is
  audited.
- The clash check is a database trigger on classes, so no path can skip it.

## Not in M5

- Email and push delivery of offers (M6; the claim link is ready for it).
- Offering to a whole list at once, waitlists and permanent places (after
  the pilot).
- Money figures in the tally (when casual places exist).

## Acceptance criteria

### Security (RLS)

- Only the school's owner sees candidates and makes offers, for their own
  school's lessons and children.
- A family sees only offers for their own children; another family can't
  read or claim them, with or without the code.
- An offer never includes who is away or why.
- A claim code works once, only signed in, only for its family, only until
  it expires.
- The last spot can't be claimed twice, even at once.
- Nobody writes offers directly.

### Rules

- Candidates are exactly the children `check_makeup` allows.
- A claimed offer books a make-up with the child's credit.
- A lesson with no spots left closes its other offers.
- A class that clashes with its instructor's other class is refused.
- The preview's numbers match what cancelling then does.

### Paths

1. An owner offers an open spot; the family claims it; the spot count drops
   and the child is on the lesson as a make-up.
2. A family says no thanks; an expired or used link says so plainly.
3. An owner previews cancelling a day, then confirms.
4. An owner opens a number on Today and sees what it counts.
