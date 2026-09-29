// The M1 demo world: Aqua House, a swim school in Mona Vale, and the
// Burrows family. `seed/demo-data.json` is the visual source of truth for
// the numbers it holds; everything it doesn't cover (rosters, candidates,
// messages) is filled in here.
//
// Nothing in this file is real data. It is deliberately tied to the seeded
// Aqua House organisation and Burrows family, so only those tenants see it
// (see service.ts).

import demo from "../../../seed/demo-data.json";

export type SkillStatus = "not_started" | "developing" | "achieved";

// IDs of the seeded tenants this demo belongs to (scripts/fixtures.ts).
// tests/unit/demo.test.ts checks they stay in step.
export const DEMO_ORG_ID = "0a000000-0000-4000-8000-000000000001";
export const DEMO_FAMILY_ID = "0f000000-0000-4000-8000-000000000001";

export const ORGANISATION = {
  name: demo.organisation.name,
  location: demo.organisation.location,
  owner: demo.organisation.owner,
  instructor: demo.organisation.instructor,
  program: "Learn to Swim",
};

export type DemoClass = {
  id: string;
  slug: string;
  name: string;
  level: string;
  day: string;
  shortDay: string;
  time: string;
  capacity: number;
  enrolled: number;
  absences: number;
  temporaryVacancies: number;
  instructor: string;
};

const SHORT_DAY: Record<string, string> = {
  Monday: "Mon",
  Tuesday: "Tue",
  Wednesday: "Wed",
  Thursday: "Thu",
  Friday: "Fri",
  Saturday: "Sat",
  Sunday: "Sun",
};

export const CLASSES: DemoClass[] = demo.classes.map((c) => ({
  ...c,
  slug: c.id,
  level: c.name,
  shortDay: SHORT_DAY[c.day] ?? c.day,
  instructor: demo.organisation.instructor,
}));

// Ava's regular class, and the class the demo's routes call "dolphin-3".
export const PRIMARY_CLASS_ID = "dolphin3-wed";
export const PRIMARY_CLASS_SLUG = "dolphin-3";

export const LEVEL_SKILLS: { name: string; hint: string }[] = [
  { name: "Floating", hint: "Floats on front and back for 5 seconds" },
  { name: "Streamline", hint: "Glides off the wall with arms locked" },
  { name: "Kick 10m", hint: "Flutter kicks 10 metres with a board" },
  { name: "Breathing", hint: "Blows bubbles and turns to breathe" },
  { name: "Freestyle 10m", hint: "Swims 10 metres of freestyle" },
];

const [avaSeed, leoSeed] = demo.family.children;

export type DemoChild = {
  slug: string;
  firstName: string;
  lastName: string;
  age: number;
  level: string;
  classId: string | null;
  schedule: { day: string; time: string };
  skills: Record<string, SkillStatus> | null;
  colour: "coral" | "mint" | "butter" | "lilac";
};

export const CHILDREN: DemoChild[] = [
  {
    slug: avaSeed!.id,
    firstName: avaSeed!.firstName,
    lastName: "Burrows",
    age: avaSeed!.age,
    level: "Dolphin 3",
    classId: PRIMARY_CLASS_ID,
    schedule: { day: "Wednesday", time: "4:30pm" },
    skills: Object.fromEntries(
      (avaSeed!.skills ?? []).map((s) => [s.name, s.status as SkillStatus]),
    ),
    colour: "coral",
  },
  {
    // A second child so the family view shows more than one; Leo's own
    // progress isn't part of the demo.
    slug: leoSeed!.id,
    firstName: leoSeed!.firstName,
    lastName: "Burrows",
    age: leoSeed!.age,
    level: leoSeed!.activities[0]!.level,
    classId: null,
    schedule: { day: leoSeed!.activities[0]!.day, time: leoSeed!.activities[0]!.time },
    skills: null,
    colour: "mint",
  },
];

export const FAMILY = {
  name: demo.family.name,
  guardian: demo.family.guardian,
};

// The 12 children enrolled in Dolphin 3 on Wednesday.
export const ROSTER: { slug: string; name: string; family: string }[] = [
  { slug: "ava", name: "Ava Burrows", family: "Burrows" },
  { slug: "oliver", name: "Oliver Chen", family: "Chen" },
  { slug: "priya", name: "Priya Patel", family: "Patel" },
  { slug: "noah", name: "Noah James", family: "James" },
  { slug: "isla", name: "Isla Moore", family: "Moore" },
  { slug: "lucas", name: "Lucas Nguyen", family: "Nguyen" },
  { slug: "ruby", name: "Ruby Thompson", family: "Thompson" },
  { slug: "jack", name: "Jack Wilson", family: "Wilson" },
  { slug: "zoe", name: "Zoe Martin", family: "Martin" },
  { slug: "henry", name: "Henry Clarke", family: "Clarke" },
  { slug: "chloe", name: "Chloe Evans", family: "Evans" },
  { slug: "max", name: "Max Kelly", family: "Kelly" },
];

// Children the Wednesday roster already knows are away, besides anything the
// parent reports in the demo. Matches the class's one recorded absence.
export const PRE_REPORTED_ABSENT = ["zoe"];

export const FAMILIES: {
  name: string;
  guardian: string;
  children: { name: string; level: string }[];
}[] = [
  {
    name: "Burrows",
    guardian: "Sarah Burrows",
    children: [
      { name: "Ava", level: "Dolphin 3" },
      { name: "Leo", level: "Dolphin 1" },
    ],
  },
  { name: "Chen", guardian: "Wei Chen", children: [{ name: "Oliver", level: "Dolphin 3" }] },
  {
    name: "Patel",
    guardian: "Anika Patel",
    children: [
      { name: "Priya", level: "Dolphin 3" },
      { name: "Arjun", level: "Dolphin 1" },
    ],
  },
  { name: "James", guardian: "Tom James", children: [{ name: "Noah", level: "Dolphin 3" }] },
  { name: "Moore", guardian: "Kate Moore", children: [{ name: "Isla", level: "Dolphin 3" }] },
  { name: "Nguyen", guardian: "Linh Nguyen", children: [{ name: "Lucas", level: "Dolphin 3" }] },
  { name: "Thompson", guardian: "Emma Thompson", children: [{ name: "Ruby", level: "Dolphin 3" }] },
  {
    name: "Wilson",
    guardian: "Ben Wilson",
    children: [
      { name: "Jack", level: "Dolphin 3" },
      { name: "Mia", level: "Dolphin 2" },
    ],
  },
];

// Children holding make-up credits who fit the open spots. Hand-picked for
// the demo; real matching is M5.
export type Candidate = {
  id: string;
  child: string;
  family: string;
  level: string;
  creditNote: string;
  classId: string;
};

export const CANDIDATES: Candidate[] = [
  {
    id: "c1",
    child: "Harper Lee",
    family: "Lee",
    level: "Dolphin 3",
    creditNote: "Credit expires in 4 days",
    classId: "dolphin3-wed",
  },
  {
    id: "c2",
    child: "Sam Ortiz",
    family: "Ortiz",
    level: "Dolphin 3",
    creditNote: "Missed last Tuesday",
    classId: "dolphin3-wed",
  },
  {
    id: "c3",
    child: "Priya Patel",
    family: "Patel",
    level: "Dolphin 3",
    creditNote: "Credit expires in 9 days",
    classId: "dolphin3-thu",
  },
  {
    id: "c4",
    child: "Noah James",
    family: "James",
    level: "Dolphin 3",
    creditNote: "Missed last Saturday",
    classId: "dolphin3-sat",
  },
  {
    id: "c5",
    child: "Grace Ho",
    family: "Ho",
    level: "Dolphin 3",
    creditNote: "Credit expires in 12 days",
    classId: "dolphin3-sat",
  },
  {
    id: "c6",
    child: "Oliver Chen",
    family: "Chen",
    level: "Dolphin 3",
    creditNote: "Missed last Wednesday",
    classId: "dolphin3-tue",
  },
];

export const DASHBOARD = demo.dashboard;

// Make-up choices shown to the Burrows family after reporting Ava away.
// Thursday is the "best fit": same time of day, next day.
export const MAKEUP_OPTION_IDS = ["dolphin3-thu", "dolphin3-sat", "dolphin3-tue"];
export const BEST_FIT_ID = "dolphin3-thu";

// Plain-language summary of the default make-up policy in RULES_ENGINE.md.
export const MAKEUP_RULE = [
  "Tell us at least 2 hours before class",
  "Your make-up credit lasts 60 days",
  "Book any Dolphin 3 class in the next 2 weeks",
];

export const LEVELS: { name: string; children: number; needAssessment: number }[] = [
  { name: "Dolphin 1", children: 31, needAssessment: 4 },
  { name: "Dolphin 2", children: 28, needAssessment: 6 },
  { name: "Dolphin 3", children: 51, needAssessment: 3 },
];

export const NEEDS_ASSESSMENT: { name: string; level: string; note: string }[] = [
  { name: "Ava Burrows", level: "Dolphin 3", note: "Kick 10m and Breathing close" },
  { name: "Lucas Nguyen", level: "Dolphin 3", note: "Not assessed in 5 weeks" },
  { name: "Arjun Patel", level: "Dolphin 1", note: "Ready for Dolphin 2?" },
  { name: "Mia Wilson", level: "Dolphin 2", note: "Not assessed in 6 weeks" },
];

export type Message = {
  id: string;
  from: string;
  title: string;
  body: string;
  when: string;
  tone: "news" | "celebrate" | "info";
};

export const MESSAGES: { group: string; messages: Message[] }[] = [
  {
    group: "This week",
    messages: [
      {
        id: "m1",
        from: "Mia Chen · Aqua House",
        title: "Ava's kick is really coming along",
        body: "She did 8 metres unassisted on Wednesday. Kick 10m is very close!",
        when: "Wed",
        tone: "celebrate",
      },
      {
        id: "m2",
        from: "Aqua House",
        title: "Pool heating works on Monday",
        body: "Lessons run as normal. The water might be a degree cooler.",
        when: "Mon",
        tone: "info",
      },
    ],
  },
  {
    group: "Earlier",
    messages: [
      {
        id: "m3",
        from: "Aqua House",
        title: "Term 4 timetable is out",
        body: "Ava and Leo keep their usual times. Nothing for you to do.",
        when: "2 wks",
        tone: "news",
      },
    ],
  },
];
