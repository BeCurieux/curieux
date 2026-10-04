# Ovyko — the first 90 days of selling

A plan for getting from "built and tested" to "a pilot school live and a
queue of schools behind it". It borrows the shape of the Sash Beds playbook
("From Bedroom Floor to Sell-Out Brand": prove demand, build a following
before launch, launch as a campaign, keep going after a quiet first week)
and changes what doesn't fit selling software to swim schools.

Read with: `docs/STRATEGY.md` (the USP and the moat), `docs/OUTREACH.md`
(the messages), `docs/WAITLIST_PAGE.md` (the page), `docs/OWNER_TODO.md`
(the setup only the owner of Ovyko can do).

## What's different from launching a product

| A dog bed | Ovyko |
|---|---|
| Impulse buy, one person decides | A school's owner decides, after a demo, usually around a term break |
| Stock in the living room | No stock; the cost of a slow start is time |
| Strangers buy from an ad | Owners buy from people they trust: other owners, a referral, a founder who understood their problem |
| Celebrities post for free | The "influencers" are respected owners and the swim-teaching community (AUSTSWIM and Swim Australia teachers, owner Facebook groups) |
| Sold out = success | One school live, happy and willing to be called = success |

So the 90 days aim at **one pilot school, live and vouching for us, and 20
schools on the waitlist**, not a big launch day.

## The three numbers we steer by

1. **Owner conversations held** (target: 10 by day 30, 25 by day 90).
2. **Schools on the waitlist** (target: 20 by day 90, from at least 2
   suburbs we can grow in).
3. **Pilot schools live** (target: 1 by day 60, 3 by day 90).

Track them weekly in one place. If a number stalls for two weeks, change
the message or the channel, not the product.

## Before day 1 (this week)

- Merge the pull request: run the database files in `docs/OWNER_TODO.md`,
  then say "merge".
- The basics a school will ask about: Supabase Pro (backups), the email
  account (Resend), the Stripe account, the privacy lawyer booked. A pilot
  school can start on Ovyko before Stripe is live (they keep their current
  billing at first), but not before backups and email.
- Pick **one area** to start in (for example the Northern Beaches, or
  wherever you can get to in person). Density is the moat
  (`docs/STRATEGY.md`), so every early school should be near the others.

## Month 1 (days 1–30): prove the problem, find the pilot

The Sash Beds lesson: she made 500 beds and sold 5 because she hadn't
proved demand first. Our version: talk before we sell.

**Week 1**
- List 50 swim schools in the chosen area: name, owner's name, size
  (pools, rough number of swimmers), what system they use if visible
  (booking links often show iClassPro, SimplySwim, Class Manager), and how
  they publish contact details.
- Write the one-line reason each school might care (a waitlist on their
  website, a Facebook post asking for make-up swaps, "no make-ups this
  term", a recent new pool).

**Weeks 2–4**
- Send 10 personal messages a week (`docs/OUTREACH.md`, message 1), each
  naming something specific about that school. Follow up once after 5 days.
- Hold 10 conversations: 20 minutes, mostly listening. Use the interview
  questions in the outreach kit and the five in `docs/STRATEGY.md`
  ("Questions to ask in the owner interviews"). Record, with permission,
  the minutes each routine job takes them today: that's the baseline for
  "we cut your admin by X%".
- Ask every owner: "Who else should I talk to?" Owners know owners.

**By day 30**
- 10 conversations, notes written up the same day.
- 2–3 schools interested in a pilot. Choose one: close by, a
  sympathetic owner, 200–1,000 swimmers, on a system we can import from.
- A one-page summary of what owners actually said. If it contradicts the
  product, the product changes, not the summary.

## Month 2 (days 31–60): the pilot goes live, the following starts

The Sash Beds lesson: build the feeling before launch, with real, scrappy
content, not a polished campaign.

**The pilot**
- A written pilot agreement: what Ovyko does, the school data agreement
  (lawyer-reviewed), free for the pilot term, a named person at Ovyko, a
  way out at any time with their data exported.
- Move the school in (`/business/settings/import`): import, prove the
  counts match their old system, run both side by side for two weeks.
- Weekly 15-minute check-in. Write down every complaint and every "oh,
  that's good".
- From week 3, look at "This month with Ovyko" together: places filled,
  fees collected, jobs done without the front desk. That screen is the
  sales pitch for every other school.

**The following**
- Put up the waitlist page (`docs/WAITLIST_PAGE.md`).
- Founder-led content, scrappy and real, once a week on LinkedIn and in
  owner groups where posting is allowed:
  - "What I learned talking to 10 swim school owners" (no names).
  - "The make-up phone call that takes 6 minutes, 40 times a week."
  - A 30-second screen recording: a parent taps "Can't make it", the spot
    is offered and filled, nobody at the desk touches it.
  - Behind the scenes of moving the pilot school in.
- Keep messaging 10 owners a week (`docs/OUTREACH.md`, messages 1–3), now
  with a reason: "We're running a pilot at a school near you."

**By day 60**
- Pilot live, families invited, the first term's re-enrolment or fees
  handled in Ovyko.
- 10+ schools on the waitlist.
- A written quote from the pilot owner, in their own words, with their
  permission to use it and their name. No invented quotes, ever.

## Month 3 (days 61–90): the founding-schools launch

The Sash Beds lesson: run the launch as a short campaign with a clear
offer, and don't stop when the first week is quiet.

**The offer** (the owner of Ovyko decides; a suggestion): **founding
schools**, the first 10 schools in the area: we move you in for free, the
first term is free, and the A$399 a month per location price is held for
two years. Honest scarcity: it's limited because we can only move a few
schools in properly at once.

**Launch week**
- Day 1: email the waitlist (`docs/OUTREACH.md`, message 5) and post the
  founder story: why Ovyko exists, who it's for, the founding-schools
  offer, one clear action ("Book a 20-minute demo").
- Days 2–3: the pilot's results, with permission: "In its first month,
  [School] filled N places that would have sat empty."
- Days 4–5: the difference: a side-by-side of a make-up done by phone and
  email versus in Ovyko.
- Days 6–7: honest urgency: "4 of 10 founding places left before the
  next term starts."
- Demos booked from the week, each followed up within a day.

**After launch week**
- Expect it to be quiet. Keep showing up: 10 messages a week, one post a
  week, every demo followed up.
- Move the second and third schools in, one at a time, in the same area.
- Ask the pilot owner to introduce you to two owners they know.

**By day 90**
- 3 schools live (or signed and moving in), all in one area.
- 20 schools on the waitlist.
- The first real "This month with Ovyko" numbers we can quote, with
  permission.

## If it's slow

Ask, in this order:
1. **Are we talking to owners, not receptionists?** The owner decides.
2. **Is the message about money and their week, or about features?**
   Lead with places filled and fees chased, not "scheduling software".
3. **Is the timing wrong?** Owners switch at term breaks. Ask when their
   next one is and book the follow-up for then.
4. **Is switching the fear?** Lead with "we move you in, and run alongside
   your current system until you're sure".

## What not to do

- Don't buy ads before there's a school vouching for us.
- Don't build features that a prospect asks for in one call; write them
  down and wait for three owners to ask.
- Don't claim numbers we haven't measured, or quote people who haven't
  agreed to it.
- Don't send bulk email to lists of schools: commercial email in
  Australia needs consent (see `docs/OUTREACH.md`, "Staying within the
  rules").
