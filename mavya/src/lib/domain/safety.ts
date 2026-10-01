import { explain, must, type Db } from "./db";

// Health notes and pickup restrictions (docs/M6_MIGRATION_PILOT.md, M6d).
// The tables can't be read directly: the database returns them through one
// function that decides who may know what and records every look by staff.

export type ChildHealth = {
  allergies: string | null;
  medicalNotes: string | null;
  updatedAt: string;
};

export type RestrictionKind = "no_collect" | "no_contact";

export type ChildRestriction = {
  id: string;
  personName: string;
  kind: RestrictionKind;
  // Owners only; null for instructors.
  details: string | null;
  addedAt: string;
};

export type ChildSafety = {
  access: "owner" | "family" | "instructor";
  health: ChildHealth | null;
  // Always empty for families.
  restrictions: ChildRestriction[];
};

export const RESTRICTION_LABELS: Record<RestrictionKind, string> = {
  no_collect: "May not collect",
  no_contact: "No contact",
};

type Raw = {
  access: ChildSafety["access"];
  health: { allergies: string | null; medical_notes: string | null; updated_at: string } | null;
  restrictions: {
    id: string;
    person_name: string;
    kind: RestrictionKind;
    details: string | null;
    added_at: string;
  }[];
};

// Opening a child's details. For staff, this is recorded.
export async function childSafety(db: Db, childId: string): Promise<ChildSafety> {
  const raw = must(await db.rpc("child_safety", { p_child: childId })) as unknown as Raw;
  return {
    access: raw.access,
    health: raw.health
      ? {
          allergies: raw.health.allergies,
          medicalNotes: raw.health.medical_notes,
          updatedAt: raw.health.updated_at,
        }
      : null,
    restrictions: raw.restrictions.map((r) => ({
      id: r.id,
      personName: r.person_name,
      kind: r.kind,
      details: r.details,
      addedAt: r.added_at,
    })),
  };
}

export type SafetyFlag = { health: boolean; restriction: boolean };

// Whether there's something to know about each child, never what. Not
// recorded; for rosters and lists.
export async function safetyFlags(db: Db, childIds: string[]): Promise<Map<string, SafetyFlag>> {
  if (childIds.length === 0) return new Map();
  const { data, error } = await db.rpc("safety_flags", { p_children: childIds });
  if (error) throw explain(error);
  return new Map(
    (data ?? [])
      .filter((f) => f.has_health || f.has_restriction)
      .map((f) => [f.child_id, { health: f.has_health, restriction: f.has_restriction }]),
  );
}

export type SafetyView = { name: string; role: "owner" | "instructor"; viewedAt: string };

// Who has looked, newest first. Owners only.
export async function safetyViews(db: Db, childId: string): Promise<SafetyView[]> {
  const { data, error } = await db.rpc("child_safety_views", { p_child: childId });
  if (error) throw explain(error);
  return (data ?? []).map((v) => ({
    name: v.viewer_name,
    role: v.viewer_role as SafetyView["role"],
    viewedAt: v.viewed_at,
  }));
}

export async function saveChildHealth(
  db: Db,
  childId: string,
  input: { allergies: string | null; medicalNotes: string | null },
) {
  const { error } = await db.rpc("save_child_health", {
    p_child: childId,
    p_allergies: input.allergies ?? "",
    p_medical_notes: input.medicalNotes ?? "",
  });
  if (error) throw explain(error);
}

export async function addRestriction(
  db: Db,
  childId: string,
  input: { personName: string; kind: RestrictionKind; details: string | null },
): Promise<string> {
  return must(
    await db.rpc("add_child_restriction", {
      p_child: childId,
      p_person: input.personName,
      p_kind: input.kind,
      p_details: input.details ?? "",
    }),
  );
}

export async function removeRestriction(db: Db, restrictionId: string) {
  const { error } = await db.rpc("remove_child_restriction", { p_restriction: restrictionId });
  if (error) throw explain(error);
}
