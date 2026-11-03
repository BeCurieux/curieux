import { reaches, type AccessTier } from "./tiers";

// The course as /learn and the lesson page see it: modules in order, their
// lessons in order, and what she has done. Pure, so ordering and "what's
// next" are unit-tested.

export interface OutlineLesson {
  id: string;
  slug: string;
  number: string;
  title: string;
  summary: string;
  min_tier: Exclude<AccessTier, "founding">;
  opens_with_benchmark_pack: boolean;
  video_provider: "bunny" | "youtube" | null;
  duration_sec: number | null;
  example: boolean;
  position: number;
}

export interface OutlineModule {
  id: string;
  slug: string;
  number: number;
  title: string;
  summary: string;
  hidden: boolean;
  position: number;
  lessons: OutlineLesson[];
}

export interface Access {
  tier: AccessTier | null;
  benchmarkPack: boolean;
}

export const canOpen = (lesson: OutlineLesson, access: Access) =>
  reaches(access.tier, lesson.min_tier) ||
  (lesson.opens_with_benchmark_pack && access.benchmarkPack);

export const lessonHref = (mod: Pick<OutlineModule, "slug">, lesson: Pick<OutlineLesson, "slug">) =>
  `/learn/${mod.slug}/${lesson.slug}`;

export function sortOutline(modules: OutlineModule[]): OutlineModule[] {
  return [...modules]
    .sort((a, b) => a.position - b.position)
    .map((mod) => ({ ...mod, lessons: [...mod.lessons].sort((a, b) => a.position - b.position) }));
}

/** Every lesson in course order, with its module. Hidden modules (the Library) stand apart. */
export function courseOrder(modules: OutlineModule[]) {
  return sortOutline(modules)
    .filter((mod) => !mod.hidden)
    .flatMap((mod) => mod.lessons.map((lesson) => ({ module: mod, lesson })));
}

/**
 * The lessons either side of this one. Inside the Library, neighbours stay
 * inside the Library; in the course, they run across module boundaries.
 */
export function neighbours(modules: OutlineModule[], lessonId: string) {
  const sorted = sortOutline(modules);
  const home = sorted.find((mod) => mod.lessons.some((l) => l.id === lessonId));
  const sequence = home?.hidden
    ? home.lessons.map((lesson) => ({ module: home, lesson }))
    : courseOrder(sorted);
  const at = sequence.findIndex((entry) => entry.lesson.id === lessonId);
  if (at === -1) return { previous: undefined, next: undefined };
  return { previous: sequence[at - 1], next: sequence[at + 1] };
}

/** Where "Continue" goes: her first lesson not yet done that she can open. */
export function continueAt(modules: OutlineModule[], done: ReadonlySet<string>, access: Access) {
  return courseOrder(modules).find(
    (entry) => !done.has(entry.lesson.id) && canOpen(entry.lesson, access),
  );
}

/** "8 min", "1 h 5 min". */
export function formatDuration(seconds: number | null): string | null {
  if (!seconds) return null;
  const minutes = Math.max(1, Math.round(seconds / 60));
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}
