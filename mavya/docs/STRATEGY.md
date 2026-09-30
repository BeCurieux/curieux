# OVYKO — Strategy

Where Ovyko is heading and how to judge each milestone against it. Built
from the market research of September 2026 (two AI-assisted reports on
SimplySwim, iClassPro, Jackrabbit, Class Manager, LoveAdmin/Thrive4, Studio
Pro and others). Their review samples are small and their citations weren't
checkable: use them for direction, and verify any figure before it goes in a
pitch or on the website.

## The thesis

The incumbents already have the checklist: enrolment, attendance, payments,
make-ups, waitlists, skills, apps. Operators often rate them well; parents
rate their apps badly (small samples: 1.4–2.4 stars). "We have make-ups and
an app" is not a reason to switch.

The opening is **orchestration**: software that resolves the work instead of
giving staff tools to do it. An absence becomes a filled place, a credit, an
updated roster and a note on the tally, with nobody at the front desk
touching it.

> **The operating system for recurring children's activities.**
> Fill more places. Remove repetitive admin. Make money understandable.
> Let parents fix routine things themselves. Give instructors a tool they
> barely have to think about.

## The seven must-haves

| # | Must-have | What it means | Where it is |
|---|---|---|---|
| 1 | **One family, one login** | One parent account across children, activities and schools; each school's data stays its own | Done (M0–M2) |
| 2 | **An engine that fills places by itself** | Absence → open place → the right family is offered it → claimed → roster, credit and capacity updated | M4–M5; automatic offers next (M5.5) |
| 3 | **A family ledger people can follow** | Every charge, credit, make-up, refund and failed payment is a line with a reason; the balance is derived, never typed | Designed before payments (M7) |
| 4 | **Instructor "Today"** | Open to the class on now; attendance and skills in seconds; works on poor pool Wi-Fi | M3; offline mode in M6 |
| 5 | **Skills that aren't swim-only** | Levels, skills and assessments as general concepts, so gymnastics or dance can use them | Done in the data model; words on screen still say "swimming" in places |
| 6 | **Messages driven by events** | Absences, offers, cancellations and progress tell the right people automatically | In-app since M3–M5; email and push in M6 |
| 7 | **Switching that's safe** | We move the school, then prove counts, balances, credits and enrolments match before go-live | M6 |

The advantage isn't any single item (each can be copied). It's how they work
together: knowing the absence, the rules, the credit, the level, the clash,
the capacity and the family, and finishing the job.

## How we measure it

Three that matter most:

- **Admin hours per 100 students** ↓
- **Filled places per available place** (on the way to revenue per
  available place-hour) ↑
- **Parent effort per task**: time, taps and failures ↓

Supporting: places refilled after absences, time to fill, share of routine
work needing no staff, make-up credits ageing, attendance completeness,
parent self-service rate, and (with payments) failed-payment recovery.

Show them to owners. Today should say what the software did this week, not
list records.

## Design rules

1. **Exceptions, not menus.** The owner's home should become "3 things need
   you; everything else is handled".
2. **Never show parents the database.** Five questions on Home: what's next,
   what needs me, what can I change, what do I owe, how is my child going.
3. **Trust before features.** Correct money before analytics; booking
   integrity before AI; an audit trail before animation.
4. **Automation is reversible and visible.** Everything the system does on
   its own is logged, explained and can be undone by a person.
5. **AI stays invisible and optional.** It may draft, suggest or explain;
   money, eligibility and safety decisions stay rule-based and auditable.
   (No AI in v0.1 without approval.)
6. **One engine, activity packs later.** Roughly 70% shared, 30% per
   activity. Never fork the product per activity.

## Where we grow, in order

Group by how a school runs, not what it teaches:

1. **Swim schools** (independent and small groups, roughly 200–3,000
   swimmers, one to ten sites). Weekly places, fixed capacity, lots of
   absences, levels, parents paying.
2. **Recreational gymnastics.** Almost the same shape.
3. **Children's dance and cheer**, once recitals and performances exist.
4. **Children's martial arts**, once belts, memberships and check-in exist.
5. **Music and tutoring**, later, as their own surface: one-to-one lessons,
   notes and practice are a different job.

Not yet: council leisure centres (procurement, facilities, concessions).

## Deliberately not building yet

Website builder, per-school branded apps, a chatbot, point of sale, full
accounting or payroll, camps and events, marketing funnels, every activity
at once, council leisure centres. Some are good later; none makes a school
switch now.

## Open questions

- **Pricing.** Ideas so far: A$129/249/449 by size; or A$199 per site plus
  A$0.35 per student; payments priced separately and visibly. Decide with
  the pilot school.
- **When payments come.** After the pilot proves the loop; the pilot keeps
  its current billing at first, which also makes switching less risky.
- **Casual-place revenue** in the tally, once a school sells casual places.
