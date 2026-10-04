# OVYKO — Strategy

Where Ovyko is heading and how to judge each milestone against it. Built
from the market research of September 2026 (two AI-assisted reports on
SimplySwim, iClassPro, Jackrabbit, Class Manager, LoveAdmin/Thrive4, Studio
Pro and others). Their review samples are small and their citations weren't
checkable: use them for direction, and verify any figure before it goes in a
pitch or on the website.

That research missed Xplor Technologies, a large software and payments
group already selling swim school software in Australia, and other larger
players. See `docs/BUSINESS_PLAN.md`, "Competitors the first research
missed (4 October 2026)" and "Who might buy Ovyko".

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

## The north star

Ovyko is infrastructure for recurring family activities, not another
booking portal with a nicer interface. It should earn two promises:

- **To providers: run your activity business almost automatically.** The
  software fills classes, handles routine admin, collects payments, manages
  families, and shows only what needs a person.
- **To families: everything your kids do, in one place.** One account for
  activities, schedules, payments, progress, messages and bookings, across
  every provider they use.

**The number we steer by: the share of routine admin Ovyko finishes with no
staff involved.** Every automatic step is logged, so it can be counted.

### The decision filter

Every major decision must do at least one of these:

1. reduce provider admin;
2. fill more places or earn more per class;
3. make things easier for families;
4. deepen the data and network advantage;
5. make Ovyko harder to replace;
6. work across more than one kind of activity.

If it does none, it waits.

### The three assets we're building

Features can be copied. These are hard to copy, and they are what an
acquirer would value:

1. **The activity automation engine.** Resolves absences, vacancies,
   make-ups, progression, waitlists, payments and scheduling on its own.
2. **The family graph.** One family → children → activities → providers →
   schedules → payments → progress, across organisations, with each
   provider seeing only what the family has shared with it.
3. **The migration and data layer.** Takes messy data from iClassPro,
   SimplySwim, Class Manager and others and turns it into one clean activity
   model. "Give us access. We'll move you."

### Phases

1. The best swim-school platform (now).
2. The best children's activity platform (gymnastics, dance, martial arts).
3. The universal family activity account.
4. Maybe discovery: "Jack has nothing on Saturday morning" → trial places,
   last-minute vacancies, holiday programs. Only once enough providers use
   Ovyko to make it useful. Not in v0.1 (CLAUDE.md rule 13).

### How we'll check we're right

Before building much further, interview and screen-share with 20–30
operators. For each routine job (an absence, a make-up, a transfer, a failed
payment, a level-up), count the clicks and minutes it takes them today. That
becomes the baseline for the pitch: "we cut your admin by X%", measured, not
guessed.

### Where today's build stands against it

| North-star piece | Today | Gap |
|---|---|---|
| Automation engine | Absence → credit → spot offered → claimed → roster, with no staff (M4–M5.5) | Waitlists, level-ups, payments; counting the "no staff" share |
| Class capacity as something to optimise | Capacity, levels, make-up rules, instructor clashes | Ratios, preferred times, sibling schedules, location, history |
| One family identity | One parent login across schools | Each school holds its own family and child records; no shared child profile yet (see below) |
| Whole-family view | Parent Home shows all children | Sibling clashes and "Leo finishes at 4:15 nearby" |
| Clean activity model | Organisation → Location → Program → Level → Class → Lesson, not swim-specific in the data | An explicit Activity kind and per-activity add-ons (lanes, belts, rehearsals) |
| Migration | Planned (M6) | Reusable importers per competitor |
| Family ledger and payments | Designed before payments (M7) | Everything |
| Data advantage | Every change audited; fill tally | Utilisation, retention and benchmarks across schools |
| Retention and lifecycle | Not started | Risk signals, trial → enrol follow-ups |
| APIs | Not started | Integrate (accounting, payroll, websites) instead of rebuilding |

### A decision to make before the pilot's data grows: the family graph

Today each school keeps its own family and child records (so one school
can never see another's children, rule 15), and a parent's single login
links to each. The north star wants the family to own the child's profile
(date of birth, medical notes, emergency contacts, carers, consents) and
**share** it with each provider. The likely shape: a family-owned profile
that a provider gets a copy of, or access to, only when the family enrols;
the school's own records (attendance, levels, credits) stay the school's.
That's a data-model and privacy change, so it needs its own milestone and
sign-off, not a quiet refactor.

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

The north star: **share of routine admin finished with no staff** ↑. Then
three that matter most:

- **Admin hours per 100 students** ↓
- **Filled places per available place** (on the way to revenue per
  available place-hour) ↑
- **Parent effort per task**: time, taps and failures ↓

Supporting: places refilled after absences, time to fill, make-up credits ageing, attendance completeness,
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

## The long-term plan: "your school, on autopilot" (3 October 2026)

The north star above, made concrete. Ovyko isn't better booking software:
it's the first system where a school mostly runs itself. The owner sets the
rules once; Ovyko does the routine work, records what it did, and shows only
what needs a person. Competitors are record-keepers; Ovyko does the work.

### Five pillars

1. **Autopilot.** Every repeated job is a rule the owner sets once:
   make-ups, filling spots, re-enrolment, reminders, chasing payments,
   instructor cover. Ovyko asks only when a rule can't decide. Started:
   automatic offers (M5.5) and re-enrolment (M6e).
2. **The child's journey, not the booking.** Schools earn by keeping
   families for years and lose them when parents can't see progress. A
   living record per child: skills, the next milestone, moments (with
   consent), moving up.
3. **Money that runs itself.** Fees, instalments, vouchers, failed
   payments and refunds inside Ovyko, flowing to Xero. Payroll and
   accounting are connected, not rebuilt.
4. **Safe for children by design.** Built: need-to-know health notes with
   every look recorded, pickup restrictions, owner two-step sign-in, audit,
   export and deletion. Next: staff checks and qualifications with expiry
   reminders, incident records, help meeting the Child Safe Standards.
5. **Insight before trouble.** "These 6 children missed 3 lessons", "Thursday
   4pm is full next term", "next term's revenue looks like A$84k". Simple
   rules first; any AI only with approval (CLAUDE.md rule 11).

It should feel quiet, warm for parents, calm for owners, built for phones on
the pool deck, and in plain words. Not a marketplace, a parent social app,
or a replacement for Xero or payroll.

### Effort

| Pillar | Built | Still to build | Difficulty | Rough time |
|---|---|---|---|---|
| Autopilot | Filling spots, automatic offers, re-enrolment, reminders | Payment chasing, instructor cover, a "needs you today" screen | Medium | 3–5 weeks |
| Child's journey | Skills, progress, levels | Moments with consent, progress reports, move-up suggestions | Medium (photos of children need strict privacy) | 2–4 weeks |
| Money | Nothing | Stripe Connect, ledger, instalments, failed payments, refunds, vouchers, Xero sync | Hardest; Stripe approval; money mistakes are costly | 2–3 months |
| Safety | Health, restrictions, two-step, audit, export, deletion | Staff checks and expiry, incidents | Easy–medium | 2–4 weeks |
| Insight | The data | Leaving risk, full classes, revenue forecast | Medium; needs the pilot's real data | 2–3 weeks |

About 6–9 months of building in all, one piece at a time after the pilot.
The limits are outside the code: testing with real schools, Stripe
approval, a privacy lawyer, support load and, above all, selling.

### Revenue (illustrations, not forecasts)

Per school a year: about A$6,000 subscription (around A$499 a month for
everything) plus about A$3,000 from payments (a school collecting A$400,000
a year, Ovyko keeping about 0.75% after card costs): roughly A$9,000–10,000.

| Schools | Realistically | A year |
|---|---|---|
| 50 | years 1–2 | ~A$0.5m |
| 200 | years 2–4 | ~A$1.9m |
| 500 (with gymnastics and dance) | years 4–6 | ~A$4.75m |
| 1,000 (with New Zealand and the UK) | years 6–8 | ~A$9.5m |

Australia has about 1,000–1,500 swim schools and SimplySwim reaches a few
hundred after 15 years, so 200 schools would make Ovyko a leader in swim;
beyond that needs more activities and countries. What moves the numbers
most: payments (without them a school is worth about half), keeping schools
(5% lost a year versus 15%), and how fast schools sign up, which the first
10 owner conversations will show.

### Order

Pilot and owner conversations → payments and vouchers → then only the piece
owners ask for most (Xero sync, staff rosters and checks, money overview,
insight) → repeat. The destination, not a build list.

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
accounting or payroll, HR, generic email marketing, document storage, camps
and events, every activity at once, council leisure centres, a marketplace.
Some are good later; none makes a school switch now. Where a school needs
one of these, connect to it (APIs) rather than rebuild it. Stay excellent at
one job: running recurring activities with as little human admin as
possible.

Later, after the pilot, with real data: retention signals ("17 families
look likely to leave this month" plus a suggested next step), lifecycle
follow-ups (trial → enrol; "Ava is ready for Level 4, here are classes
that fit the family"), and benchmarks across schools ("your Saturday
mornings are 91% full versus 84% for similar schools").

## Open questions

- **Pricing.** Ideas so far: A$129/249/449 by size; or A$199 per site plus
  A$0.35 per student; payments priced separately and visibly. Decide with
  the pilot school.
- **When payments come.** After the pilot proves the loop; the pilot keeps
  its current billing at first, which also makes switching less risky.
- **Casual-place revenue** in the tally, once a school sells casual places.
