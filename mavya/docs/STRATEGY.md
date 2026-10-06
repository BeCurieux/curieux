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

## The USP and the moat (4 October 2026)

The owner of Ovyko's direction: Ovyko is **the operating network for
children's activities**, not better swim-school software. Everything below
is judged against this section first.

### In one line each

- **For schools:** *Fill more places. Get paid. Know what families want
  next. All without the front desk.*
- **For families:** *One place for your children's activities, schedules,
  progress and payments.*

### The USP: why a school switches (today)

**Ovyko turns empty places and unpaid fees into money, on its own, and
shows the dollars.** Not "save your receptionist six hours": the incumbents
already sell admin features (iClassPro has make-up tokens, temporary
openings and waitlist offers). What they don't do is resolve the whole job
with nobody touching it, then prove what it was worth:

> (An illustration.) **This month Ovyko filled 327 places that would have sat empty, collected
> $41,200 in fees, chased $6,300 that was overdue (all but $400 is in),
> and kept 41 families for next term. 23 hours of front-desk work, done.**

A USP is what wins customers. It is not a moat: a competitor can copy any
feature. So the USP buys time to build the moat.

### The moat: why a school can't easily leave, and a competitor can't copy

Honestly: **at day zero Ovyko has no moat.** Moats are earned, in this
order, and each layer only exists once the one before it is real:

| Layer | What it is | Why it's hard to copy or leave | When it's real |
|---|---|---|---|
| 1. The automation | The engine resolves absences, places, make-ups, payments and re-enrolment with no staff | Copyable in time; but a school that has stopped doing these jobs by hand won't go back | First school live |
| 2. The money | Fees, instalments and direct debits run through Ovyko | Leaving means every family re-entering payment details and the school running two systems | Payments live at the pilot |
| 3. The demand data | What families want and can't book: "17 children want Tuesday 4:30 beginners" | Only exists because families told Ovyko; an incumbent's database only sees bookings that happened | Months of use per school |
| 4. The family identity | A family-owned profile (children, levels, availability) shared with each provider | The family, not the school, holds it; it gets more valuable with every provider they use | Several providers in one area |
| 5. The network | Families using Ovyko with 2+ providers; demand matched to capacity across providers | Classic network effect: each provider and family makes Ovyko more useful to the rest | Density in one area |

Not moats, so we don't spend the moat budget on them: CRM, email tools,
rosters, basic scheduling, invoicing, website builders, generic AI. Build
enough of these to win the first schools; put the serious work into the
five layers.

### The moat needs density, not breadth

Layers 4 and 5 only exist where families use **several** Ovyko providers.
So growth is suburb by suburb, not school by school across Australia: one
pilot swim school, then 10–20 providers in the same area (swim, gymnastics,
dance) before the next area. The metric that proves the moat:

> **The share of families who use Ovyko with two or more providers.**

If it doesn't grow, Ovyko is renting each school's customers, not owning a
network, and should be valued (and run) as software only.

### The moat test for every feature

Before building something, say which layer it deepens. If it deepens none
and doesn't win schools (the USP), it waits. The decision filter below
still applies; this comes first.

### Questions to settle before building the later layers

1. **Will schools accept the Activity Passport?** A verified record that
   moves with the child makes it easier for a family to leave a school.
   Schools receiving families gain, the school losing them doesn't. Test
   it in the owner interviews before building it; it belongs to the family
   and is shared by them.
2. **Children's data across organisations.** Layers 4 and 5 move
   children's details between providers. Only with a family-owned profile
   that the family shares (CLAUDE.md rule 15), a privacy lawyer's review,
   and the coming children's online privacy code in mind.
3. **Bolt-on or platform?** Selling the engine on top of other systems
   (iClassPro, ClassForKids, ThinkSmart) would let a buyer switch it on for
   all its customers, but incumbents keep their systems closed and a
   feature sells for less than a platform. Decision: stay a full platform
   for the first schools, and build the engine with its own clean
   interface so the bolt-on route stays open.
4. **When the rules change.** Matching families to other providers and
   "Build My Term" are discovery (CLAUDE.md rule 13); churn prediction may
   count as AI (rule 11). Both are ruled out in v0.1. Changing that is the
   owner's written decision, after the density test above passes.
5. **Ovyko's 0.5% fee on payments** may be low for a business whose value
   rests partly on payments. Revisit before the pilot sets expectations.

### Questions to ask in the owner interviews

Add these to the outreach kit's questions; the answers decide the later
layers:

1. "When a family moves to you from another school, what do you get from
   the old school? Would a record of the child's levels and skills,
   shared by the family, help?" (the passport, receiving side)
2. "If a family leaving you could take that record with them, would that
   worry you?" (the passport, losing side)
3. "How do you find out families want a time you don't run? Have you
   ever started a class because of it?" (demand data)
4. "How many of your families also do gymnastics, dance or another
   activity nearby? Do you know the other providers?" (density)
5. "What did you collect last month, and how much was late? How do you
   chase it?" (the USP in dollars)

### Who already buys companies like Ovyko (checked 4 October 2026)

Buyers have already paid for companies in Ovyko's category, so the buyers
aren't hypothetical. Checked against the companies' own pages:

| When | Buyer | Bought | What it tells us |
|---|---|---|---|
| Feb 2023 | The Access Group | ClassForKids (UK kids' clubs; now "4,500+ clubs and 1 million parents") | Big software groups buy the family relationship at scale |
| Nov 2023 | DaySmart | Sawyer (US), named for its "two-sided model": software for providers plus a marketplace for parents | Software plus a family-facing network is what gets named in the deal |
| Feb 2024 | ClearCourse ("software and payments specialist") | ThinkSmart Software, about 2,500 customers, mostly children's activities (swimming, gymnastics, dance, tennis, music); operates in Australia | Payments groups buy activity software to add payments to it |
| Sep 2025 | Xplor merging with Clubessential; Xplor buying Ezypay (Australian recurring billing) | | Xplor (about $47bn a year in payments) keeps buying payments and recurring billing in Australia |

Also checked: iClassPro already automates make-up tokens, temporary
openings and waitlist offers, so automation alone isn't the moat.
Jackrabbit is still privately held, not part of Xplor. Vertical software
was 54% of SaaS acquisitions in Q2 2026 (Software Equity Group).

Sources: theaccessgroup.com (ClassForKids news, Feb 2023); classforkids.io;
clearcourse.co.uk (ThinkSmart release, 7 Feb 2024); llrpartners.com
(DaySmart acquires Sawyer, 6 Nov 2023); adventinternational.com (Xplor and
Clubessential, 16 Sep 2025); xplor.com (Ezypay); support.iclasspro.com and
iclasspro.com (automation workflows); softwareequity.com (2Q26 report).

So Ovyko must build **the next asset these buyers need** (demand data, a
family network, payments in Australia), not a copy of what they already
own.

### What gets built next because of this

- **"What Ovyko did for you this month"** for owners: the USP, made
  visible (`docs/M8_NETWORK.md`, M8a).
- **Unmet demand, within one school:** families say what times they'd
  want; the owner sees "new class opportunity" and fills it in one go
  (M8b). The first piece of layer 3, and no marketplace: it never leaves
  the school.
- Then, with sign-off and a lawyer: the family-owned child profile, the
  base of layers 4 and 5.

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

## Why a buyer like Xplor would buy Ovyko (4 October 2026)

Not today. A large group buys a small company when buying it is cheaper
than beating it. (Buyers and the A$20m arithmetic: `docs/BUSINESS_PLAN.md`,
"Who might buy Ovyko".)

### Why groups like Xplor buy

Xplor earns most of its money from payments, a small share of every dollar
its customers collect; software is how it gets that flow. It buys:

1. **Customers and their payments in one go.** Winning 500 schools one at
   a time takes years of selling.
2. **To stop a competitor taking its customers.** If independent schools
   keep choosing Ovyko, buying it ends the losses and keeps the payments.
3. **Something it can't easily build:** a product owners love, for a
   market its own software serves badly.

### What would make Ovyko worth buying to them

- **Independent swim schools are their gap.** Their product is built for
  councils and big recreation centres; reviews complain of poor service
  and features that don't work well together. An Ovyko that clearly wins
  small schools fills that gap.
- **Ovyko's payments become theirs.** A buyer can move Ovyko's schools
  onto its own payments (Debitsuccess). With about A$200m a year flowing
  through Ovyko, that alone could pay for the purchase.
- **Their costs are lower than ours.** They already have sales, support
  and payments; Ovyko's customers and product cost them little extra.
- **Proof, not promises:** schools that rarely leave and owners who refer
  other owners.

### Why they might not

- **They could copy the ideas.** Automatic make-ups and re-enrolment can
  be copied; a product owners love and a reputation for care are harder.
- **They might compete harder instead**, with lower prices or bundled
  payments, if Ovyko stays small.
- **Other buyers exist** (The Access Group, DaySmart, Jackrabbit).
  Interest from more than one is what lifts the price.

### What it means for the plan

1. **Win independent schools clearly.** It's the gap the big groups
   leave, and the reason anyone would buy Ovyko.
2. **Get payments flowing.** More money through Ovyko makes it worth more
   to every buyer, and most of all to a payments group like Xplor.
3. **Track from day one** how many schools leave, how much money flows
   through Ovyko, and whether schools pay more over time.

Don't build Ovyko for Xplor. Build it so independent schools love it and
it makes good money; then a sale is an option, not a need.
