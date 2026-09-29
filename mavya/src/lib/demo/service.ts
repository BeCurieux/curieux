import "server-only";
import type { Viewer } from "@/lib/auth/viewer";
import type { ClassSummary } from "@/lib/domain/timetable";
import {
  AVA_ID,
  AVA_SKILLS,
  BEST_FIT_ID,
  CANDIDATES,
  DASHBOARD,
  DEMO_CLASS_NUMBERS,
  DEMO_FAMILY_ID,
  DEMO_ORG_ID,
  LEVEL_SKILLS,
  MAKEUP_CLASSES,
  MAKEUP_OPTION_IDS,
  PRE_REPORTED_ABSENT,
  PRIMARY_CLASS_ID,
  PRIMARY_CLASS_SLUG,
  type MakeupClass,
  type SkillStatus,
} from "./data";
import { levelProgress } from "./progress";
import type { DemoState } from "./state-schema";

// The demo overlay: the parts of M1 that stay mocked until M3–M5, applied
// to real classes and children. Screens get real rows from src/lib/domain
// and pass them through here; they never work anything out themselves.
//
// Tenancy holds: only the seeded Aqua House staff and Burrows family see
// any of it, and only on the seeded classes and children.

export function isDemoFamily(viewer: Viewer): boolean {
  return viewer.families.some((f) => f.familyId === DEMO_FAMILY_ID);
}

export function isDemoStaff(viewer: Viewer, role: "owner" | "instructor"): boolean {
  return viewer.staff.some((s) => s.organisationId === DEMO_ORG_ID && s.role === role);
}

// ------------------------------------------------------------------ routes

// The docs name /business/classes/dolphin-3 and /family/kids/ava; these keep
// those addresses working alongside real ids.
export function resolveClassId(param: string): string {
  return param === PRIMARY_CLASS_SLUG ? PRIMARY_CLASS_ID : param;
}

export function classSlug(classId: string): string {
  return classId === PRIMARY_CLASS_ID ? PRIMARY_CLASS_SLUG : classId;
}

export function resolveChildId(
  param: string,
  children: { id: string; firstName: string }[],
): string | null {
  if (children.some((c) => c.id === param)) return param;
  const byName = children.filter((c) => c.firstName.toLowerCase() === param.toLowerCase());
  return byName.length === 1 ? byName[0]!.id : null;
}

export function childSlug(
  child: { id: string; firstName: string },
  siblings: { firstName: string }[],
): string {
  const unique = siblings.filter((s) => s.firstName === child.firstName).length === 1;
  return unique ? child.firstName.toLowerCase() : child.id;
}

// ------------------------------------------------------------------ classes

export type ClassView = ClassSummary & {
  absences: number;
  temporaryVacancies: number;
  expected: number;
  occupancy: number;
};

export function withDemo(c: ClassSummary, state: DemoState): ClassView {
  const numbers = DEMO_CLASS_NUMBERS[c.id];
  const avaAway = c.id === PRIMARY_CLASS_ID && state.absence !== null;
  const avaMakeupHere = state.makeupClassId === c.id;
  const absences = (numbers?.absences ?? 0) + (avaAway ? 1 : 0);
  const temporaryVacancies = numbers
    ? Math.max(0, numbers.temporaryVacancies + (avaAway ? 1 : 0) - (avaMakeupHere ? 1 : 0))
    : 0;
  const expected = c.enrolled - absences + (avaMakeupHere ? 1 : 0);
  return {
    ...c,
    absences,
    temporaryVacancies,
    expected,
    occupancy: c.capacity ? Math.round((expected / c.capacity) * 100) : 0,
  };
}

export function isDemoClass(classId: string): boolean {
  return classId in DEMO_CLASS_NUMBERS;
}

// ------------------------------------------------------------------ children

export type ChildDemo = {
  skillList: { name: string; hint: string; status: SkillStatus }[] | null;
  progress: number | null;
  achieved: number;
  away: boolean;
  makeup: MakeupClass | null;
};

export function childDemo(childId: string, state: DemoState): ChildDemo {
  const isAva = childId === AVA_ID;
  const skillList = isAva
    ? LEVEL_SKILLS.map((s) => ({
        ...s,
        status: state.skills[s.name] ?? AVA_SKILLS[s.name] ?? "not_started",
      }))
    : null;
  const makeup =
    isAva && state.makeupClassId
      ? (MAKEUP_CLASSES.find((c) => c.id === state.makeupClassId) ?? null)
      : null;
  return {
    skillList,
    progress: skillList ? levelProgress(skillList.map((s) => s.status)) : null,
    achieved: skillList ? skillList.filter((s) => s.status === "achieved").length : 0,
    away: isAva && state.absence !== null,
    makeup,
  };
}

// ------------------------------------------------------------------ make-ups

export type MakeupOption = MakeupClass & { bestFit: boolean; spots: number };

// The open spots in each make-up class. A class Ava is already booked into
// still shows, with her place counted back in.
export function makeupOptions(): MakeupOption[] {
  return MAKEUP_CLASSES.filter((c) => c.temporaryVacancies > 0).map((c) => ({
    ...c,
    bestFit: c.id === BEST_FIT_ID,
    spots: c.temporaryVacancies,
  }));
}

export function isMakeupOption(id: string): boolean {
  return MAKEUP_OPTION_IDS.includes(id);
}

// ------------------------------------------------------------------ business

export function dashboard(classes: ClassView[], state: DemoState) {
  return {
    ...DASHBOARD,
    reportedAbsences: DASHBOARD.reportedAbsences + (state.absence ? 1 : 0),
    temporaryVacancies: classes.reduce((sum, c) => sum + c.temporaryVacancies, 0),
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

export function rosterStatus(childId: string, classId: string, state: DemoState) {
  const reportedAway =
    classId === PRIMARY_CLASS_ID &&
    (PRE_REPORTED_ABSENT.includes(childId) || (childId === AVA_ID && state.absence !== null));
  const marked = classId === PRIMARY_CLASS_ID ? state.attendance[childId] : undefined;
  const status: RosterStatus = marked ?? (reportedAway ? "reported_away" : "unmarked");
  return { status, reportedAway, hasProgress: childId === AVA_ID };
}

export function isLevelSkill(name: string): boolean {
  return LEVEL_SKILLS.some((s) => s.name === name);
}
