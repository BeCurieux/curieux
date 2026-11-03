// Tier order and names, for display. Access itself is decided in the
// database (can_open_lesson, lesson_content); these only label things.

export type AccessTier = "free" | "module0" | "course" | "founding";

const RANK: Record<AccessTier, number> = { free: 0, module0: 1, course: 2, founding: 3 };

export function reaches(tier: AccessTier | null, min: AccessTier): boolean {
  return tier !== null && RANK[tier] >= RANK[min];
}

/** What a locked lesson or module tells her it needs. */
export const UNLOCKED_BY: Record<Exclude<AccessTier, "founding">, string> = {
  free: "the free Product Check",
  module0: "Module 0",
  course: "the full course",
};
