// What is still demo: a few sample messages from the school. Everything
// else is real (src/lib/domain).
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
