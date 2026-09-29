# M1 — Beautiful Interactive Demo

## Goal

Create the full core experience visually using seeded demo data before implementing the full operational backend.

The demo must feel like a product someone could believe is already live.

## Seed organisation

**Aqua House**
Activity type: swimming
Location: Mona Vale

Owner:
Sarah Morgan

Instructor:
Mia Chen

Families:
Burrows Family
Chen Family
Patel Family
James Family

Primary demo child:
Ava Burrows, 7

Program:
Learn to Swim

Level:
Dolphin 3

Skills:
- Floating
- Streamline
- Kick 10m
- Breathing
- Freestyle 10m

Primary recurring class:
Dolphin 3
Wednesday
4:30pm
Capacity 14
Instructor Mia Chen

Additional make-up classes:
Thursday 4:30pm
Saturday 9:00am
Tuesday 5:00pm

## Required parent screens

### `/family`
Home
- This week
- Ava swimming card
- Leo placeholder second child
- action card: "Can't make Wednesday?"
- next milestone / message

### `/family/calendar`
- clean weekly view
- activity cards
- mobile-first

### `/family/kids/ava`
- Dolphin 3
- 80% progress
- achieved/developing skills
- next class
- Report absence button

### `/family/absence`
Flow:
- confirm occurrence
- optional reason
- summary of make-up rule
- confirm

### `/family/makeups`
- "Best fit" card
- additional eligible classes
- book CTA
- confirmation state

### `/family/messages`
- simple grouped messages
- no inbox clutter

## Required business screens

### `/business`
Dashboard:
- 94 children expected
- 6 reported absences
- 4 temporary vacancies
- 7 make-up credits expiring
- capacity 92%
- Fill 4 open spots CTA

### `/business/classes`
- today's classes
- occupancy
- absence/vacancy status
- class detail link

### `/business/classes/dolphin-3`
- roster
- upcoming occurrence
- temporary vacancy
- eligible make-up candidate count

### `/business/families`
- searchable list
- simple family cards

### `/business/progress`
- level / skill overview
- children needing assessment

## Required instructor screens

### `/instructor`
Today's assigned classes.

### `/instructor/class/dolphin-3`
- attendance
- tap-friendly rows
- progress shortcut

### `/instructor/child/ava`
- skill list
- change Kick 10m from developing → achieved
- save
- success state

## Interaction requirements

The following must be clickable in demo mode:

Parent:
- report absence
- view make-ups
- select Saturday 9am
- confirm make-up
- view Ava progress

Business:
- Fill Open Spots
- inspect Dolphin 3
- inspect candidate list

Instructor:
- open class
- mark attendance
- update Ava skill

## Demo data state

Use `seed/demo-data.json` as the visual source of truth.

M1 may use mocked service functions if needed.

Do not fake interactions with dead buttons.

## Acceptance criteria

1. Parent flow is excellent at 390px width.
2. Business dashboard is excellent at laptop width.
3. Instructor flow is usable one-handed on phone.
4. No generic shadcn visual identity remains.
5. All primary demo-path buttons work.
6. No full M4 business rules are implemented yet.
7. Playwright covers the primary demo path.
8. Lighthouse accessibility is reasonable; no obvious contrast/tap-target failures.

## Decisions made while building M1

These resolve contradictions in the original demo data. `seed/demo-data.json`
has been updated to match.

1. **Progress is calculated, not stored.** Ava's skills (2 achieved, 2
   developing, 1 not started) cannot add up to the original 80%. Progress is
   now worked out from the skills: achieved counts 1, developing counts ½,
   not started counts 0. Ava shows 60%, and 70% once Kick 10m is achieved.
2. **Four temporary vacancies.** Thursday 4:30pm had 2, making the classes
   total 5 against a dashboard and acceptance test of 4. Thursday now has 1.
3. **No cross-provider activities.** Ava's Peak Gymnastics activity is
   removed. Showing another provider's classes needs cross-provider child
   identity, which `DATA_MODEL.md` defers, and rule 15 forbids exposing
   children's data across organisations.
4. **Demo data is scoped to its tenant.** Only the Aqua House staff and the
   Burrows family see the demo. Any other organisation or family sees an
   empty state, never another tenant's demo data.
5. **Demo interactions are remembered per browser** in a cookie, not in the
   database, so M1 changes no tables. The instructor's skill update shows up
   in the parent's view in the same browser, which demonstrates the proof
   loop without implementing M3/M4 rules.
6. **Muted text is slightly darker.** `--text-muted` moved from `#6F7282` to
   `#626575`. The original measured 4.4:1 against the tinted backgrounds,
   just under the WCAG AA minimum of 4.5:1; the new value passes on every
   background the app uses. `--success` likewise moved from `#3C9C73` to
   `#2E7D5B`, because white text on it measured 3.4:1. `DESIGN_SYSTEM.md`
   is updated to match.
