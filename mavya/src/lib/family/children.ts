import "server-only";
import { childSlug } from "@/lib/demo/service";
import type { Db } from "@/lib/domain/db";
import { familyLessons, type FamilyLesson } from "@/lib/domain/lessons";
import { availableCredits } from "@/lib/domain/makeups";
import { childrenProgress, type LevelProgress } from "@/lib/domain/progress";
import { myChildren, type FamilyChild } from "@/lib/domain/schedule";
import { listClasses, type ClassSummary } from "@/lib/domain/timetable";

// A parent's children as the family app shows them: their classes, progress,
// next lesson (and whether they're away from it), booked make-ups and
// unused make-up credits. All from the database, through the parent's own
// access.

const COLOURS = ["coral", "mint", "butter", "lilac"] as const;

export type ScheduledLesson = FamilyLesson & { klass: ClassSummary };

export type FamilyChildView = FamilyChild & {
  slug: string;
  colour: (typeof COLOURS)[number];
  primary: ClassSummary | null;
  // Progress through the level of their first class; null until that level
  // has skills.
  progress: LevelProgress | null;
  // Their next regular lesson that isn't cancelled, and whether they're away.
  next: ScheduledLesson | null;
  away: boolean;
  // Later lessons they're reported away from, which can still be taken back.
  laterAway: ScheduledLesson[];
  // Their next booked make-up.
  makeup: ScheduledLesson | null;
  credits: number;
};

// How far ahead the family app looks for lessons.
const LOOKAHEAD_DAYS = 28;

export async function familyChildren(db: Db): Promise<FamilyChildView[]> {
  const children = await myChildren(db);
  const [progress, lessons, credits, classes] = await Promise.all([
    childrenProgress(
      db,
      children.map((c) => ({ id: c.id, levelId: c.classes[0]?.levelId ?? null })),
    ),
    familyLessons(
      db,
      children.map((c) => ({ id: c.id, classIds: c.classes.map((k) => k.id) })),
      LOOKAHEAD_DAYS,
    ),
    availableCredits(
      db,
      children.map((c) => c.id),
    ),
    listClasses(db),
  ]);
  const classById = new Map(classes.map((c) => [c.id, c]));
  const scheduled = lessons.flatMap((l) => {
    const klass = classById.get(l.classId);
    return klass ? [{ ...l, klass }] : [];
  });

  return children.map((child, i) => {
    const mine = scheduled.filter((l) => l.childId === child.id && l.status !== "cancelled");
    const next = mine.find((l) => l.kind === "regular") ?? null;
    return {
      ...child,
      slug: childSlug(child, children),
      colour: COLOURS[i % COLOURS.length]!,
      primary: child.classes[0] ?? null,
      progress: progress.get(child.id) ?? null,
      next,
      away: Boolean(next?.absenceId),
      laterAway: mine.filter((l) => l.kind === "regular" && l !== next && l.absenceId),
      makeup: mine.find((l) => l.kind === "makeup") ?? null,
      credits: credits.filter((c) => c.childId === child.id).length,
    };
  });
}

export async function findFamilyChild(db: Db, slug: string) {
  const children = await familyChildren(db);
  return children.find((c) => c.slug === slug || c.id === slug) ?? null;
}

// A family's lessons in the coming week, with their classes.
export async function familyWeek(db: Db, children: FamilyChild[]): Promise<ScheduledLesson[]> {
  const [lessons, classes] = await Promise.all([
    familyLessons(
      db,
      children.map((c) => ({ id: c.id, classIds: c.classes.map((k) => k.id) })),
      7,
    ),
    listClasses(db),
  ]);
  const classById = new Map(classes.map((c) => [c.id, c]));
  return lessons.flatMap((l) => {
    const klass = classById.get(l.classId);
    return klass ? [{ ...l, klass }] : [];
  });
}
