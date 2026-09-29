// The people, tenants and timetable the seed creates, shared with the tests
// that check they stay apart.
//
// There are deliberately two of everything: two organisations, each with
// its own staff, families and classes. A security test with only one tenant
// can't show that another tenant's data is refused.
//
// Aqua House matches seed/demo-data.json: the four Dolphin 3 classes with
// 12, 12, 13 and 13 children, Ava in Wednesday's, Leo in Dolphin 1. Peak
// Gymnastics, its staff and the Chen family are invented, because the demo
// data doesn't cover a second provider.
//
// IDs are fixed so tests and the M1 demo overlay can refer to rows directly.

const id = (prefix: string, n: number) =>
  `${prefix.padEnd(8, "0")}-0000-4000-8000-${String(n).padStart(12, "0")}`;

export const ORGS = {
  aqua: { id: id("0a", 1), name: "Aqua House", slug: "aqua-house", activity_type: "swimming" },
  peak: {
    id: id("0a", 2),
    name: "Peak Gymnastics",
    slug: "peak-gymnastics",
    activity_type: "gymnastics",
  },
} as const;

type OrgKey = keyof typeof ORGS;
type FamilyKey = "burrows" | "chen";
type ClassKey =
  "dolphin3Wed" | "dolphin3Thu" | "dolphin3Sat" | "dolphin3Tue" | "dolphin1Tue" | "gymLevel2Sat";

type ClassFixture = {
  id: string;
  organisation_id: string;
  location_id: string;
  program_id: string;
  level_id: string;
  instructor_id: string;
  name: string;
  weekday: number;
  start_time: string;
  duration_minutes: number;
  capacity: number;
};

// ------------------------------------------------------------------ people

type StaffRole = "owner" | "instructor";

export type SeedUser = {
  email: string;
  name: string;
  staff?: { org: OrgKey; role: StaffRole; membershipId: string };
  family?: { family: FamilyKey; relationship: string; primary: boolean };
};

export const USERS = {
  aquaOwner: {
    email: "sarah.morgan@aquahouse.test",
    name: "Sarah Morgan",
    staff: { org: "aqua", role: "owner", membershipId: id("05", 1) },
  },
  aquaInstructor: {
    email: "mia.chen@aquahouse.test",
    name: "Mia Chen",
    staff: { org: "aqua", role: "instructor", membershipId: id("05", 2) },
  },
  peakOwner: {
    email: "dan.okafor@peakgym.test",
    name: "Dan Okafor",
    staff: { org: "peak", role: "owner", membershipId: id("05", 3) },
  },
  peakInstructor: {
    email: "lucy.hart@peakgym.test",
    name: "Lucy Hart",
    staff: { org: "peak", role: "instructor", membershipId: id("05", 4) },
  },
  // Teaches nothing in the seed. Tests remove and restore this person's access.
  aquaCasual: {
    email: "sam.ortiz@aquahouse.test",
    name: "Sam Ortiz",
    staff: { org: "aqua", role: "instructor", membershipId: id("05", 5) },
  },
  burrowsParent: {
    email: "sarah.burrows@family.test",
    name: "Sarah Burrows",
    family: { family: "burrows", relationship: "mother", primary: true },
  },
  chenParent: {
    email: "grace.chen@family.test",
    name: "Grace Chen",
    family: { family: "chen", relationship: "mother", primary: true },
  },
} as const satisfies Record<string, SeedUser>;

// ------------------------------------------------------------------ timetable

export const LOCATIONS = {
  monaVale: {
    id: id("0e", 1),
    organisation_id: ORGS.aqua.id,
    name: "Mona Vale",
    address_line1: "12 Pittwater Road",
    suburb: "Mona Vale",
    state: "NSW",
    postcode: "2103",
    timezone: "Australia/Sydney",
  },
  narrabeen: {
    id: id("0e", 2),
    organisation_id: ORGS.peak.id,
    name: "Narrabeen",
    address_line1: "4 Ocean Street",
    suburb: "Narrabeen",
    state: "NSW",
    postcode: "2101",
    timezone: "Australia/Sydney",
  },
} as const;

export const PROGRAMS = {
  learnToSwim: {
    id: id("0b", 1),
    organisation_id: ORGS.aqua.id,
    name: "Learn to Swim",
    type: "recurring",
  },
  gymnastics: {
    id: id("0b", 2),
    organisation_id: ORGS.peak.id,
    name: "Recreational Gymnastics",
    type: "recurring",
  },
} as const;

export const LEVELS = {
  dolphin1: {
    id: id("0d", 1),
    organisation_id: ORGS.aqua.id,
    program_id: PROGRAMS.learnToSwim.id,
    name: "Dolphin 1",
    sort_order: 1,
  },
  dolphin2: {
    id: id("0d", 2),
    organisation_id: ORGS.aqua.id,
    program_id: PROGRAMS.learnToSwim.id,
    name: "Dolphin 2",
    sort_order: 2,
  },
  dolphin3: {
    id: id("0d", 3),
    organisation_id: ORGS.aqua.id,
    program_id: PROGRAMS.learnToSwim.id,
    name: "Dolphin 3",
    sort_order: 3,
  },
  gymLevel2: {
    id: id("0d", 4),
    organisation_id: ORGS.peak.id,
    program_id: PROGRAMS.gymnastics.id,
    name: "Level 2",
    sort_order: 2,
  },
} as const;

const aquaClass = (
  n: number,
  name: string,
  level: string,
  weekday: number,
  start_time: string,
): ClassFixture => ({
  id: id("0c1a55", n),
  organisation_id: ORGS.aqua.id,
  location_id: LOCATIONS.monaVale.id,
  program_id: PROGRAMS.learnToSwim.id,
  level_id: level,
  instructor_id: USERS.aquaInstructor.staff.membershipId,
  name,
  weekday,
  start_time,
  duration_minutes: 30,
  capacity: 14,
});

export const CLASSES: Record<ClassKey, ClassFixture> = {
  dolphin3Wed: aquaClass(1, "Dolphin 3", LEVELS.dolphin3.id, 3, "16:30"),
  dolphin3Thu: aquaClass(2, "Dolphin 3", LEVELS.dolphin3.id, 4, "16:30"),
  dolphin3Sat: aquaClass(3, "Dolphin 3", LEVELS.dolphin3.id, 6, "09:00"),
  dolphin3Tue: aquaClass(4, "Dolphin 3", LEVELS.dolphin3.id, 2, "17:00"),
  dolphin1Tue: aquaClass(5, "Dolphin 1", LEVELS.dolphin1.id, 2, "17:00"),
  gymLevel2Sat: {
    id: id("0c1a55", 6),
    organisation_id: ORGS.peak.id,
    location_id: LOCATIONS.narrabeen.id,
    program_id: PROGRAMS.gymnastics.id,
    level_id: LEVELS.gymLevel2.id,
    instructor_id: USERS.peakInstructor.staff.membershipId,
    name: "Level 2",
    weekday: 6,
    start_time: "10:00",
    duration_minutes: 60,
    capacity: 12,
  },
};

// ------------------------------------------------------------------ families

type Child = { first: string; last: string; dob: string; classes: ClassKey[] };
type FamilyFixture = {
  id: string;
  organisation_id: string;
  display_name: string;
  primary_contact_name: string;
  primary_contact_email: string;
  children: (Child & { id: string })[];
};

// The two families with parent accounts. Their children keep the IDs they
// had in M0.
const namedFamilies: Record<FamilyKey, FamilyFixture> = {
  burrows: {
    id: id("0f", 1),
    organisation_id: ORGS.aqua.id,
    display_name: "Burrows Family",
    primary_contact_name: "Sarah Burrows",
    primary_contact_email: "sarah.burrows@family.test",
    children: [
      {
        id: id("0c", 1),
        first: "Ava",
        last: "Burrows",
        dob: "2019-03-14",
        classes: ["dolphin3Wed"],
      },
      {
        id: id("0c", 2),
        first: "Leo",
        last: "Burrows",
        dob: "2022-05-02",
        classes: ["dolphin1Tue"],
      },
    ],
  },
  chen: {
    id: id("0f", 2),
    organisation_id: ORGS.peak.id,
    display_name: "Chen Family",
    primary_contact_name: "Grace Chen",
    primary_contact_email: "grace.chen@family.test",
    children: [
      { id: id("0c", 3), first: "Mei", last: "Chen", dob: "2018-11-20", classes: ["gymLevel2Sat"] },
    ],
  },
};

// Everyone else at Aqua House, by class, so the counts match the demo:
// Wednesday 12 (with Ava), Thursday 12, Saturday 13, Tuesday 13.
const roster: { last: string; guardian: string; children: Child[] }[] = [
  {
    last: "Chen",
    guardian: "Wei Chen",
    children: [{ first: "Oliver", last: "Chen", dob: "2018-08-02", classes: ["dolphin3Wed"] }],
  },
  {
    last: "Patel",
    guardian: "Anika Patel",
    children: [
      { first: "Priya", last: "Patel", dob: "2019-01-19", classes: ["dolphin3Wed"] },
      { first: "Arjun", last: "Patel", dob: "2022-02-11", classes: ["dolphin1Tue"] },
    ],
  },
  {
    last: "James",
    guardian: "Tom James",
    children: [{ first: "Noah", last: "James", dob: "2018-12-07", classes: ["dolphin3Wed"] }],
  },
  {
    last: "Moore",
    guardian: "Kate Moore",
    children: [{ first: "Isla", last: "Moore", dob: "2019-06-23", classes: ["dolphin3Wed"] }],
  },
  {
    last: "Nguyen",
    guardian: "Linh Nguyen",
    children: [{ first: "Lucas", last: "Nguyen", dob: "2019-02-28", classes: ["dolphin3Wed"] }],
  },
  {
    last: "Thompson",
    guardian: "Emma Thompson",
    children: [{ first: "Ruby", last: "Thompson", dob: "2018-10-15", classes: ["dolphin3Wed"] }],
  },
  {
    last: "Wilson",
    guardian: "Ben Wilson",
    children: [{ first: "Jack", last: "Wilson", dob: "2019-04-04", classes: ["dolphin3Wed"] }],
  },
  {
    last: "Martin",
    guardian: "Claire Martin",
    children: [{ first: "Zoe", last: "Martin", dob: "2019-07-30", classes: ["dolphin3Wed"] }],
  },
  {
    last: "Clarke",
    guardian: "Sam Clarke",
    children: [{ first: "Henry", last: "Clarke", dob: "2018-09-12", classes: ["dolphin3Wed"] }],
  },
  {
    last: "Evans",
    guardian: "Rachel Evans",
    children: [{ first: "Chloe", last: "Evans", dob: "2019-05-08", classes: ["dolphin3Wed"] }],
  },
  {
    last: "Kelly",
    guardian: "Paul Kelly",
    children: [{ first: "Max", last: "Kelly", dob: "2018-11-01", classes: ["dolphin3Wed"] }],
  },
];

const FIRST_NAMES = [
  "Amelia",
  "Archie",
  "Charlotte",
  "Eli",
  "Evie",
  "Finn",
  "Freya",
  "George",
  "Hazel",
  "Hugo",
  "Ivy",
  "Jasper",
  "Lily",
  "Luca",
  "Lola",
  "Milo",
  "Nina",
  "Oscar",
  "Poppy",
  "Quinn",
  "Rosie",
  "Sienna",
  "Theo",
  "Willow",
  "Xavier",
  "Zara",
  "Alfie",
  "Billie",
  "Cooper",
  "Daisy",
  "Edie",
  "Felix",
  "Georgia",
  "Harvey",
  "Indie",
  "Jude",
  "Kit",
];
const LAST_NAMES = [
  "Adams",
  "Bell",
  "Brooks",
  "Carter",
  "Cole",
  "Davies",
  "Ellis",
  "Fraser",
  "Grant",
  "Hayes",
  "Hughes",
  "Jensen",
  "Khan",
  "Lane",
  "Lowe",
  "Marsh",
  "Nash",
  "Owens",
  "Park",
  "Quinlan",
  "Reid",
  "Rowe",
  "Shaw",
  "Stone",
  "Tran",
  "Vale",
  "Walsh",
  "West",
  "Young",
  "Zhou",
  "Ashby",
  "Bishop",
  "Crane",
  "Dunn",
  "Ford",
  "Gill",
  "Hart",
];
const others: ClassKey[] = [
  ...Array<ClassKey>(12).fill("dolphin3Thu"),
  ...Array<ClassKey>(13).fill("dolphin3Sat"),
  ...Array<ClassKey>(12).fill("dolphin3Tue"),
];
others.forEach((classKey, i) => {
  const year = 2018 + (i % 2);
  const month = String((i % 12) + 1).padStart(2, "0");
  const day = String((i % 27) + 1).padStart(2, "0");
  roster.push({
    last: LAST_NAMES[i]!,
    guardian: `Parent ${LAST_NAMES[i]}`,
    children: [
      {
        first: FIRST_NAMES[i]!,
        last: LAST_NAMES[i]!,
        dob: `${year}-${month}-${day}`,
        classes: [classKey],
      },
    ],
  });
});
// Tuesday's 13th: Oliver Chen also swims Tuesdays.
roster[0]!.children[0]!.classes.push("dolphin3Tue");

let childNumber = 100;
const rosterFamilies: FamilyFixture[] = roster.map((f, i) => ({
  id: id("0f", 100 + i),
  organisation_id: ORGS.aqua.id,
  display_name: `${f.last} Family`,
  primary_contact_name: f.guardian,
  primary_contact_email: `${f.guardian.toLowerCase().replace(/[^a-z]+/g, ".")}@family.test`,
  children: f.children.map((c) => ({ ...c, id: id("0c", childNumber++) })),
}));

export const FAMILIES = namedFamilies;
export const ALL_FAMILIES: FamilyFixture[] = [
  namedFamilies.burrows,
  namedFamilies.chen,
  ...rosterFamilies,
];

const childByName = (first: string, last: string) => {
  for (const f of ALL_FAMILIES) {
    const c = f.children.find((ch) => ch.first === first && ch.last === last);
    if (c) return c.id;
  }
  throw new Error(`No fixture child ${first} ${last}`);
};

export const CHILDREN = {
  ava: { id: childByName("Ava", "Burrows"), family_id: namedFamilies.burrows.id },
  leo: { id: childByName("Leo", "Burrows"), family_id: namedFamilies.burrows.id },
  mei: { id: childByName("Mei", "Chen"), family_id: namedFamilies.chen.id },
  zoe: { id: childByName("Zoe", "Martin") },
  oliver: { id: childByName("Oliver", "Chen") },
};

// ------------------------------------------------------------------ rows

// Every non-auth row the seed writes, in dependency order, as plain table
// rows. seed.ts sends them through the API and seed-sql.ts prints them as
// SQL, so the two can't drift apart.
export function seedRows() {
  const rows: { table: string; conflict: string; rows: Record<string, unknown>[] }[] = [];
  rows.push({
    table: "organisations",
    conflict: "id",
    rows: Object.values(ORGS).map((o) => ({ ...o })),
  });
  rows.push({
    table: "locations",
    conflict: "id",
    rows: Object.values(LOCATIONS).map((l) => ({ ...l })),
  });
  rows.push({
    table: "programs",
    conflict: "id",
    rows: Object.values(PROGRAMS).map((p) => ({ ...p })),
  });
  rows.push({
    table: "levels",
    conflict: "id",
    rows: Object.values(LEVELS).map((l) => ({ ...l })),
  });
  rows.push({
    table: "families",
    conflict: "id",
    rows: ALL_FAMILIES.map((f) => ({
      id: f.id,
      organisation_id: f.organisation_id,
      display_name: f.display_name,
      primary_contact_name: f.primary_contact_name,
      primary_contact_email: f.primary_contact_email,
    })),
  });
  rows.push({
    table: "children",
    conflict: "id",
    rows: ALL_FAMILIES.flatMap((f) =>
      f.children.map((c) => ({
        id: c.id,
        organisation_id: f.organisation_id,
        family_id: f.id,
        first_name: c.first,
        last_name: c.last,
        date_of_birth: c.dob,
      })),
    ),
  });
  return rows;
}

// Classes reference staff memberships, which exist only once their users do,
// so they are written after the users.
export function classRows() {
  return Object.values(CLASSES).map((c) => ({ ...c }));
}

export function enrolmentRows() {
  let n = 1;
  return ALL_FAMILIES.flatMap((f) =>
    f.children.flatMap((c) =>
      c.classes.map((classKey) => ({
        id: id("0e1201", n++),
        organisation_id: f.organisation_id,
        child_id: c.id,
        class_id: CLASSES[classKey].id,
        status: "active",
        starts_at: "2026-07-20",
      })),
    ),
  );
}
