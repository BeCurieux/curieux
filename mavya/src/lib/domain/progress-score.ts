export type SkillStatus = "not_started" | "developing" | "achieved";

// How far through a level a child is. Achieved skills count fully,
// developing ones half, not-started ones not at all. Pure, so the number on
// screen always matches the skills beside it.
const WEIGHT: Record<SkillStatus, number> = { achieved: 1, developing: 0.5, not_started: 0 };

export function levelProgress(statuses: SkillStatus[]): number {
  if (statuses.length === 0) return 0;
  const total = statuses.reduce((sum, status) => sum + WEIGHT[status], 0);
  return Math.round((total / statuses.length) * 100);
}
