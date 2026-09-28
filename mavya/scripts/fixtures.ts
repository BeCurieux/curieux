// The people and tenants the seed creates, shared with the tests that check
// they stay apart.
//
// There are deliberately two of everything: two organisations, two families.
// A security test with only one tenant can't show that another tenant's
// data is refused.
//
// Names come from seed/demo-data.json where it has them. Peak Gymnastics'
// staff and the Chen family's guardian and child are invented, because the
// demo data doesn't name them.

export const ORGS = {
  aqua: {
    id: "0a000000-0000-4000-8000-000000000001",
    name: "Aqua House",
    slug: "aqua-house",
    activity_type: "swimming",
  },
  peak: {
    id: "0a000000-0000-4000-8000-000000000002",
    name: "Peak Gymnastics",
    slug: "peak-gymnastics",
    activity_type: "gymnastics",
  },
} as const;

export const FAMILIES = {
  burrows: { id: "0f000000-0000-4000-8000-000000000001", display_name: "Burrows Family" },
  chen: { id: "0f000000-0000-4000-8000-000000000002", display_name: "Chen Family" },
} as const;

export const CHILDREN = {
  ava: {
    id: "0c000000-0000-4000-8000-000000000001",
    family_id: FAMILIES.burrows.id,
    first_name: "Ava",
    last_name: "Burrows",
    date_of_birth: "2019-03-14",
  },
  leo: {
    id: "0c000000-0000-4000-8000-000000000002",
    family_id: FAMILIES.burrows.id,
    first_name: "Leo",
    last_name: "Burrows",
    date_of_birth: "2022-05-02",
  },
  mei: {
    id: "0c000000-0000-4000-8000-000000000003",
    family_id: FAMILIES.chen.id,
    first_name: "Mei",
    last_name: "Chen",
    date_of_birth: "2018-11-20",
  },
} as const;

type StaffRole = "owner" | "instructor";

export type SeedUser = {
  email: string;
  name: string;
  staff?: { org: keyof typeof ORGS; role: StaffRole };
  family?: { family: keyof typeof FAMILIES; relationship: string; primary: boolean };
};

export const USERS = {
  aquaOwner: {
    email: "sarah.morgan@aquahouse.test",
    name: "Sarah Morgan",
    staff: { org: "aqua", role: "owner" },
  },
  aquaInstructor: {
    email: "mia.chen@aquahouse.test",
    name: "Mia Chen",
    staff: { org: "aqua", role: "instructor" },
  },
  peakOwner: {
    email: "dan.okafor@peakgym.test",
    name: "Dan Okafor",
    staff: { org: "peak", role: "owner" },
  },
  peakInstructor: {
    email: "lucy.hart@peakgym.test",
    name: "Lucy Hart",
    staff: { org: "peak", role: "instructor" },
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
