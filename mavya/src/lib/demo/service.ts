import "server-only";
import type { Viewer } from "@/lib/auth/viewer";
import {
  BEST_FIT_ID,
  CANDIDATES,
  CHILDREN,
  CLASSES,
  DASHBOARD,
  DEMO_FAMILY_ID,
  DEMO_ORG_ID,
  LEVEL_SKILLS,
  MAKEUP_OPTION_IDS,
  PRE_REPORTED_ABSENT,
  PRIMARY_CLASS_ID,
  PRIMARY_CLASS_SLUG,
  ROSTER,
  type DemoChild,
  type DemoClass,
  type SkillStatus,
} from "./data";
import { levelProgress } from "./progress";
import type { DemoState } from "./state-schema";

// Mocked domain services for the M1 demo. Screens ask these functions what
// to show; they never work anything out themselves. Real services replace
// these in M2–M5.
//
// Tenancy holds even in the demo: the data belongs to the seeded Aqua House
// organisation and Burrows family, and anyone else gets nothing.

export function isDemoFamily(viewer: Viewer): boolean {
  return viewer.families.some((f) => f.familyId === DEMO_FAMILY_ID);
}

export function isDemoStaff(viewer: Viewer, role: "owner" | "instructor"): boolean {
  return viewer.staff.some((s) => s.organisationId === DEMO_ORG_ID && s.role === role);
}

// ------------------------------------------------------------------ classes

export type ClassView = DemoClass & {
  absences: number;
  temporaryVacancies: number;
  expected: number;
  occupancy: number;
};

export function classView(demoClass: DemoClass, state: DemoState): ClassView {
  const avaAway = demoClass.id === PRIMARY_CLASS_ID && state.absence !== null;
  const avaMakeupHere = state.makeupClassId === demoClass.id;
  const absences = demoClass.absences + (avaAway ? 1 : 0);
  const temporaryVacancies = Math.max(
    0,
    demoClass.temporaryVacancies + (avaAway ? 1 : 0) - (avaMakeupHere ? 1 : 0),
  );
  const expected = demoClass.enrolled - absences + (avaMakeupHere ? 1 : 0);
  return {
    ...demoClass,
    absences,
    temporaryVacancies,
    expected,
    occupancy: Math.round((expected / demoClass.capacity) * 100),
  };
}

export function allClasses(state: DemoState): ClassView[] {
  return CLASSES.map((c) => classView(c, state));
}

export function findClass(id: string, state: DemoState): ClassView | null {
  const found = CLASSES.find((c) => c.id === id);
  return found ? classView(found, state) : null;
}

// ------------------------------------------------------------------ children

export type ChildView = DemoChild & {
  skillList: { name: string; hint: string; status: SkillStatus }[] | null;
  progress: number | null;
  achieved: number;
  away: boolean;
  makeup: ClassView | null;
};

export function childView(child: DemoChild, state: DemoState): ChildView {
  const skillList = child.skills
    ? LEVEL_SKILLS.map((s) => ({
        ...s,
        status: state.skills[s.name] ?? child.skills![s.name] ?? "not_started",
      }))
    : null;
  const isAva = child.classId === PRIMARY_CLASS_ID;
  return {
    ...child,
    skillList,
    progress: skillList ? levelProgress(skillList.map((s) => s.status)) : null,
    achieved: skillList ? skillList.filter((s) => s.status === "achieved").length : 0,
    away: isAva && state.absence !== null,
    makeup: isAva && state.makeupClassId ? findClass(state.makeupClassId, state) : null,
  };
}

export function familyChildren(state: DemoState): ChildView[] {
  return CHILDREN.map((c) => childView(c, state));
}

export function findChild(slug: string, state: DemoState): ChildView | null {
  const found = CHILDREN.find((c) => c.slug === slug);
  return found ? childView(found, state) : null;
}

// ------------------------------------------------------------------ make-ups

export type MakeupOption = ClassView & { bestFit: boolean; spots: number };

export function makeupOptions(state: DemoState): MakeupOption[] {
  return MAKEUP_OPTION_IDS.map((id) => {
    const view = findClass(id, state)!;
    // A class Ava is already booked into still shows, so the confirmation
    // can point at it, with the spot she took counted back.
    const spots = view.temporaryVacancies + (state.makeupClassId === id ? 1 : 0);
    return { ...view, bestFit: id === BEST_FIT_ID, spots };
  }).filter((o) => o.spots > 0);
}

export function isMakeupOption(id: string): boolean {
  return MAKEUP_OPTION_IDS.includes(id);
}

// ------------------------------------------------------------------ business

export function dashboard(state: DemoState) {
  const classes = allClasses(state);
  const vacancies = classes.reduce((sum, c) => sum + c.temporaryVacancies, 0);
  return {
    ...DASHBOARD,
    reportedAbsences: DASHBOARD.reportedAbsences + (state.absence ? 1 : 0),
    temporaryVacancies: vacancies,
  };
}

export function candidatesFor(classId: string, state: DemoState) {
  return CANDIDATES.filter((c) => c.classId === classId).map((c) => ({
    ...c,
    offered: state.offered.includes(c.id),
  }));
}

export function isCandidate(id: string): boolean {
  return CANDIDATES.some((c) => c.id === id);
}

// ------------------------------------------------------------------ roster

export type RosterStatus = "present" | "absent" | "reported_away" | "unmarked";

export function roster(state: DemoState) {
  return ROSTER.map((r) => {
    const reportedAway =
      PRE_REPORTED_ABSENT.includes(r.slug) || (r.slug === "ava" && state.absence !== null);
    const marked = state.attendance[r.slug];
    const status: RosterStatus = marked ?? (reportedAway ? "reported_away" : "unmarked");
    return { ...r, status, reportedAway, hasProgress: r.slug === "ava" };
  });
}

export function isRosterChild(slug: string): boolean {
  return ROSTER.some((r) => r.slug === slug);
}

export function isLevelSkill(name: string): boolean {
  return LEVEL_SKILLS.some((s) => s.name === name);
}

// Ava's Wednesday class is the demo's "Dolphin 3" and lives at the short
// URL the docs name; the other occurrences use their ids.
export function classSlug(c: { id: string }): string {
  return c.id === PRIMARY_CLASS_ID ? PRIMARY_CLASS_SLUG : c.id;
}

export function findClassBySlug(slug: string, state: DemoState): ClassView | null {
  return findClass(slug === PRIMARY_CLASS_SLUG ? PRIMARY_CLASS_ID : slug, state);
}
