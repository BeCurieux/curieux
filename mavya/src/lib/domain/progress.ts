import "server-only";
import { must, type Db } from "./db";
import { levelProgress, type SkillStatus } from "./progress-score";

// Skills and each child's progress through them
// (docs/M3_ATTENDANCE_PROGRESS.md). Owners manage a level's skills;
// record_progress in the database decides who may assess whom.

export type { SkillStatus };

export type Skill = { id: string; name: string; hint: string; sortOrder: number };

export type SkillWithStatus = Skill & { status: SkillStatus };

export type LevelProgress = {
  levelId: string;
  skills: SkillWithStatus[];
  progress: number;
  achieved: number;
};

// Active skills of each level, in order.
export async function levelSkills(db: Db, levelIds: string[]): Promise<Map<string, Skill[]>> {
  const byLevel = new Map<string, Skill[]>();
  if (levelIds.length === 0) return byLevel;
  const rows = must(
    await db
      .from("skills")
      .select("id, level_id, name, description, sort_order")
      .in("level_id", levelIds)
      .eq("active", true)
      .order("sort_order")
      .order("name"),
  );
  for (const r of rows) {
    const list = byLevel.get(r.level_id) ?? [];
    list.push({ id: r.id, name: r.name, hint: r.description ?? "", sortOrder: r.sort_order });
    byLevel.set(r.level_id, list);
  }
  return byLevel;
}

// Each child's status per skill.
async function statuses(db: Db, childIds: string[]) {
  const byChild = new Map<string, Map<string, SkillStatus>>();
  if (childIds.length === 0) return byChild;
  const rows = must(
    await db.from("progress_records").select("child_id, skill_id, status").in("child_id", childIds),
  );
  for (const r of rows) {
    const skills = byChild.get(r.child_id) ?? new Map<string, SkillStatus>();
    skills.set(r.skill_id, r.status as SkillStatus);
    byChild.set(r.child_id, skills);
  }
  return byChild;
}

// Where each child is up to in their level. Null for a child whose level has
// no skills yet.
export async function childrenProgress(
  db: Db,
  children: { id: string; levelId: string | null }[],
): Promise<Map<string, LevelProgress | null>> {
  const levelIds = [...new Set(children.flatMap((c) => (c.levelId ? [c.levelId] : [])))];
  const [skills, records] = await Promise.all([
    levelSkills(db, levelIds),
    statuses(
      db,
      children.map((c) => c.id),
    ),
  ]);
  return new Map(
    children.map((c) => {
      const list = c.levelId ? skills.get(c.levelId) : undefined;
      if (!c.levelId || !list?.length) return [c.id, null];
      const mine = records.get(c.id);
      const withStatus = list.map((s) => ({ ...s, status: mine?.get(s.id) ?? "not_started" }));
      return [
        c.id,
        {
          levelId: c.levelId,
          skills: withStatus,
          progress: levelProgress(withStatus.map((s) => s.status)),
          achieved: withStatus.filter((s) => s.status === "achieved").length,
        },
      ] as const;
    }),
  );
}

export async function childProgress(db: Db, childId: string, levelId: string | null) {
  return (await childrenProgress(db, [{ id: childId, levelId }])).get(childId) ?? null;
}

export async function recordProgress(
  db: Db,
  input: { childId: string; skillId: string; status: SkillStatus },
) {
  const { error } = await db.rpc("record_progress", {
    p_child_id: input.childId,
    p_skill_id: input.skillId,
    p_status: input.status,
  });
  must({ data: true, error });
}

// ------------------------------------------------------------------ owners

// New skills go after the level's existing ones.
export async function addSkill(
  db: Db,
  input: { organisationId: string; levelId: string; name: string; hint: string | null },
) {
  const existing = must(await db.from("skills").select("sort_order").eq("level_id", input.levelId));
  const next = existing.reduce((max, s) => Math.max(max, s.sort_order), 0) + 1;
  return must(
    await db
      .from("skills")
      .insert({
        organisation_id: input.organisationId,
        level_id: input.levelId,
        name: input.name,
        description: input.hint,
        sort_order: next,
      })
      .select("id")
      .single(),
  ).id;
}

// Removed skills keep their progress history; they just stop showing.
export async function removeSkill(db: Db, skillId: string) {
  must(
    await db
      .from("skills")
      .update({ active: false })
      .eq("id", skillId)
      .eq("active", true)
      .select("id")
      .single(),
  );
}

export type LevelOverview = {
  id: string;
  name: string;
  program: string;
  skills: number;
  children: number;
  toAssess: number;
};

export type AssessmentGap = {
  childId: string;
  name: string;
  level: string;
  lastAssessed: string | null;
};

// A child needs assessing when nobody has updated their skills in four weeks.
export const ASSESS_EVERY_DAYS = 28;

// Each level's children, and who hasn't been assessed lately. Owners only:
// row level security gives anyone else a partial picture.
export async function progressOverview(db: Db, now = new Date()) {
  const [levels, skills, enrolments, records] = await Promise.all([
    db
      .from("levels")
      .select("id, name, sort_order, programs (name)")
      .eq("active", true)
      .order("sort_order"),
    db.from("skills").select("level_id").eq("active", true),
    db
      .from("enrolments")
      .select("child_id, classes (level_id), children (first_name, last_name)")
      .eq("status", "active"),
    db.from("progress_records").select("child_id, assessed_at"),
  ]);
  const cutoff = now.getTime() - ASSESS_EVERY_DAYS * 24 * 60 * 60 * 1000;
  const lastAssessed = new Map<string, string>();
  for (const r of must(records)) {
    const seen = lastAssessed.get(r.child_id);
    if (!seen || r.assessed_at > seen) lastAssessed.set(r.child_id, r.assessed_at);
  }
  const skillCount = new Map<string, number>();
  for (const s of must(skills)) skillCount.set(s.level_id, (skillCount.get(s.level_id) ?? 0) + 1);

  const rows = must(enrolments) as unknown as {
    child_id: string;
    classes: { level_id: string } | null;
    children: { first_name: string; last_name: string } | null;
  }[];
  // A child in two classes at the same level counts once.
  const childrenByLevel = new Map<string, Map<string, string>>();
  for (const r of rows) {
    if (!r.classes) continue;
    const kids = childrenByLevel.get(r.classes.level_id) ?? new Map<string, string>();
    kids.set(r.child_id, `${r.children?.first_name ?? ""} ${r.children?.last_name ?? ""}`.trim());
    childrenByLevel.set(r.classes.level_id, kids);
  }

  const due = (childId: string) => {
    const last = lastAssessed.get(childId);
    return !last || new Date(last).getTime() < cutoff;
  };

  const levelRows = must(levels) as unknown as {
    id: string;
    name: string;
    programs: { name: string } | null;
  }[];
  const overview: LevelOverview[] = levelRows.map((l) => {
    const kids = [...(childrenByLevel.get(l.id)?.keys() ?? [])];
    const hasSkills = (skillCount.get(l.id) ?? 0) > 0;
    return {
      id: l.id,
      name: l.name,
      program: l.programs?.name ?? "",
      skills: skillCount.get(l.id) ?? 0,
      children: kids.length,
      toAssess: hasSkills ? kids.filter(due).length : 0,
    };
  });

  const gaps: AssessmentGap[] = levelRows
    .filter((l) => (skillCount.get(l.id) ?? 0) > 0)
    .flatMap((l) =>
      [...(childrenByLevel.get(l.id)?.entries() ?? [])]
        .filter(([childId]) => due(childId))
        .map(([childId, name]) => ({
          childId,
          name,
          level: l.name,
          lastAssessed: lastAssessed.get(childId) ?? null,
        })),
    )
    // Longest waiting first: never assessed, then oldest.
    .sort((a, b) => (a.lastAssessed ?? "").localeCompare(b.lastAssessed ?? ""));

  return { levels: overview, gaps };
}
