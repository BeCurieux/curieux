// What is still demo after M4: the families offered a spot on Fill Empty
// Spots (M5) and a few messages. Everything else is real (src/lib/domain).
// Only the seeded Aqua House staff and Burrows family see any of it
// (see service.ts).

import {
  CHILDREN as FIXTURE_CHILDREN,
  CLASSES as FIXTURE_CLASSES,
  FAMILIES,
  ORGS,
} from "../../../scripts/fixtures";

// The seeded tenants this demo belongs to (scripts/fixtures.ts).
export const DEMO_ORG_ID = ORGS.aqua.id;
export const DEMO_FAMILY_ID = FAMILIES.burrows.id;

// Ava's regular class, which the docs' routes call "dolphin-3".
export const PRIMARY_CLASS_ID = FIXTURE_CLASSES.dolphin3Wed.id;
export const PRIMARY_CLASS_SLUG = "dolphin-3";

export const AVA_ID = FIXTURE_CHILDREN.ava.id;

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
