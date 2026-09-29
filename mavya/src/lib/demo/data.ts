// What is still demo after M2: absences, make-ups, vacancies, attendance,
// skills, candidates and messages. Classes, families, children and
// enrolments are real (src/lib/domain); this layers the rest on top of the
// seeded Aqua House classes and Burrows family, and nothing else
// (see service.ts). Each part moves into the database in M3–M5.

import demo from "../../../seed/demo-data.json";
import {
  CHILDREN as FIXTURE_CHILDREN,
  CLASSES as FIXTURE_CLASSES,
  FAMILIES,
  ORGS,
} from "../../../scripts/fixtures";

export type SkillStatus = "not_started" | "developing" | "achieved";

// The seeded tenants this demo belongs to (scripts/fixtures.ts).
export const DEMO_ORG_ID = ORGS.aqua.id;
export const DEMO_FAMILY_ID = FAMILIES.burrows.id;

export const ORGANISATION = {
  name: demo.organisation.name,
  location: demo.organisation.location,
  owner: demo.organisation.owner,
  instructor: demo.organisation.instructor,
};

// The demo's classes are real classes now (M2). This maps each real class
// to the numbers seed/demo-data.json gives it for the parts that are still
// demo until M4–M5: absences and temporary vacancies.
const DEMO_CLASS_IDS: Record<string, string> = {
  "dolphin3-wed": FIXTURE_CLASSES.dolphin3Wed.id,
  "dolphin3-thu": FIXTURE_CLASSES.dolphin3Thu.id,
  "dolphin3-sat": FIXTURE_CLASSES.dolphin3Sat.id,
  "dolphin3-tue": FIXTURE_CLASSES.dolphin3Tue.id,
};

export const DEMO_CLASS_NUMBERS: Record<string, { absences: number; temporaryVacancies: number }> =
  Object.fromEntries(
    demo.classes.map((c) => [
      DEMO_CLASS_IDS[c.id]!,
      { absences: c.absences, temporaryVacancies: c.temporaryVacancies },
    ]),
  );

// Ava's regular class, which the docs' routes call "dolphin-3".
export const PRIMARY_CLASS_ID = FIXTURE_CLASSES.dolphin3Wed.id;
export const PRIMARY_CLASS_SLUG = "dolphin-3";

export const AVA_ID = FIXTURE_CHILDREN.ava.id;

export const LEVEL_SKILLS: { name: string; hint: string }[] = [
  { name: "Floating", hint: "Floats on front and back for 5 seconds" },
  { name: "Streamline", hint: "Glides off the wall with arms locked" },
  { name: "Kick 10m", hint: "Flutter kicks 10 metres with a board" },
  { name: "Breathing", hint: "Blows bubbles and turns to breathe" },
  { name: "Freestyle 10m", hint: "Swims 10 metres of freestyle" },
];

// Ava's skills until progress is real (M3).
export const AVA_SKILLS: Record<string, SkillStatus> = Object.fromEntries(
  (demo.family.children[0]!.skills ?? []).map((s) => [s.name, s.status as SkillStatus]),
);

// Zoe is already reported away from Wednesday's class (its one absence).
export const PRE_REPORTED_ABSENT = [FIXTURE_CHILDREN.zoe.id];

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
    classId: FIXTURE_CLASSES.dolphin3Wed.id,
  },
  {
    id: "c2",
    child: "Sam Ortiz",
    family: "Ortiz",
    level: "Dolphin 3",
    creditNote: "Missed last Tuesday",
    classId: FIXTURE_CLASSES.dolphin3Wed.id,
  },
  {
    id: "c3",
    child: "Priya Patel",
    family: "Patel",
    level: "Dolphin 3",
    creditNote: "Credit expires in 9 days",
    classId: FIXTURE_CLASSES.dolphin3Thu.id,
  },
  {
    id: "c4",
    child: "Noah James",
    family: "James",
    level: "Dolphin 3",
    creditNote: "Missed last Saturday",
    classId: FIXTURE_CLASSES.dolphin3Sat.id,
  },
  {
    id: "c5",
    child: "Grace Ho",
    family: "Ho",
    level: "Dolphin 3",
    creditNote: "Credit expires in 12 days",
    classId: FIXTURE_CLASSES.dolphin3Sat.id,
  },
  {
    id: "c6",
    child: "Oliver Chen",
    family: "Chen",
    level: "Dolphin 3",
    creditNote: "Missed last Wednesday",
    classId: FIXTURE_CLASSES.dolphin3Tue.id,
  },
];

export const DASHBOARD = demo.dashboard;

// Make-up choices shown to the Burrows family after reporting Ava away.
// Thursday is the "best fit": same time of day, next day.
export const MAKEUP_OPTION_IDS = [
  FIXTURE_CLASSES.dolphin3Thu.id,
  FIXTURE_CLASSES.dolphin3Sat.id,
  FIXTURE_CLASSES.dolphin3Tue.id,
];
export const BEST_FIT_ID = FIXTURE_CLASSES.dolphin3Thu.id;

// What a parent is shown about each make-up class. Parents can't read other
// classes from the database (row level security only shows them their own
// children's), so until M4's eligibility service these come from the demo.
export type MakeupClass = {
  id: string;
  day: string;
  shortDay: string;
  time: string;
  level: string;
  instructor: string;
  temporaryVacancies: number;
};

export const MAKEUP_CLASSES: MakeupClass[] = MAKEUP_OPTION_IDS.map((id) => {
  const demoId = Object.entries(DEMO_CLASS_IDS).find(([, real]) => real === id)![0];
  const c = demo.classes.find((k) => k.id === demoId)!;
  return {
    id,
    day: c.day,
    shortDay: c.day.slice(0, 3),
    time: c.time,
    level: c.name,
    instructor: demo.organisation.instructor,
    temporaryVacancies: c.temporaryVacancies,
  };
});

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
