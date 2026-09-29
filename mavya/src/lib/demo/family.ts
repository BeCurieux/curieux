import "server-only";
import { childrenProgress, type LevelProgress } from "@/lib/domain/progress";
import { myChildren, type FamilyChild } from "@/lib/domain/schedule";
import type { ClassSummary } from "@/lib/domain/timetable";
import type { Db } from "@/lib/domain/db";
import { childDemo, childSlug, type ChildDemo } from "./service";
import type { DemoState } from "./state-schema";

// A parent's children as the family app shows them: real children, classes
// and progress from the database, with the demo's absence and make-up
// layered on for Ava until M4.

const COLOURS = ["coral", "mint", "butter", "lilac"] as const;

export type FamilyChildView = FamilyChild &
  ChildDemo & {
    slug: string;
    colour: (typeof COLOURS)[number];
    primary: ClassSummary | null;
    // Progress through the level of their first class; null until that
    // level has skills.
    progress: LevelProgress | null;
  };

export async function familyChildren(db: Db, state: DemoState): Promise<FamilyChildView[]> {
  const children = await myChildren(db);
  const progress = await childrenProgress(
    db,
    children.map((c) => ({ id: c.id, levelId: c.classes[0]?.levelId ?? null })),
  );
  return children.map((child, i) => ({
    ...child,
    ...childDemo(child.id, state),
    slug: childSlug(child, children),
    colour: COLOURS[i % COLOURS.length]!,
    primary: child.classes[0] ?? null,
    progress: progress.get(child.id) ?? null,
  }));
}

export async function findFamilyChild(db: Db, state: DemoState, slug: string) {
  const children = await familyChildren(db, state);
  return children.find((c) => c.slug === slug || c.id === slug) ?? null;
}
