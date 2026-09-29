import "server-only";
import { myChildren, type FamilyChild } from "@/lib/domain/schedule";
import type { ClassSummary } from "@/lib/domain/timetable";
import type { Db } from "@/lib/domain/db";
import { childDemo, childSlug, type ChildDemo } from "./service";
import type { DemoState } from "./state-schema";

// A parent's children as the family app shows them: real children and
// classes from the database, with the demo's skills, absence and make-up
// layered on for Ava until M3–M4.

const COLOURS = ["coral", "mint", "butter", "lilac"] as const;

export type FamilyChildView = FamilyChild &
  ChildDemo & {
    slug: string;
    colour: (typeof COLOURS)[number];
    primary: ClassSummary | null;
  };

export async function familyChildren(db: Db, state: DemoState): Promise<FamilyChildView[]> {
  const children = await myChildren(db);
  return children.map((child, i) => ({
    ...child,
    ...childDemo(child.id, state),
    slug: childSlug(child, children),
    colour: COLOURS[i % COLOURS.length]!,
    primary: child.classes[0] ?? null,
  }));
}

export async function findFamilyChild(db: Db, state: DemoState, slug: string) {
  const children = await familyChildren(db, state);
  return children.find((c) => c.slug === slug || c.id === slug) ?? null;
}
