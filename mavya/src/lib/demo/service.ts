import "server-only";
import type { Viewer } from "@/lib/auth/viewer";
import {
  CANDIDATES,
  DEMO_FAMILY_ID,
  DEMO_ORG_ID,
  PRIMARY_CLASS_ID,
  PRIMARY_CLASS_SLUG,
} from "./data";
import type { DemoState } from "./state-schema";

// What stays demo until M5: the families offered a spot on Fill Empty Spots.
// Only the seeded Aqua House staff and Burrows family see any of it.

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

// ------------------------------------------------------------------ fill empty spots

export function candidatesFor(classId: string, state: DemoState) {
  return CANDIDATES.filter((c) => c.classId === classId).map((c) => ({
    ...c,
    offered: state.offered.includes(c.id),
  }));
}

export function isCandidate(id: string): boolean {
  return CANDIDATES.some((c) => c.id === id);
}
