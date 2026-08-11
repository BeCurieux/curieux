// The graph's memory, in the database.
//
// Three queries and no judgement. Every decision worth arguing about is in
// identity.ts (which pairs to ask about) and resolve.ts (what an answer does
// to the graph); both are pure and tested without a database. This file
// exists so that neither of them has to know what a table is.
//
// The one rule enforced here rather than upstream: recording an answer and
// merging the entities are a single act. A resolution stored without the
// merge leaves the graph unchanged while the question is permanently
// silenced — the worst of both, and invisible until somebody notices that
// telling Qotidia about their grandmother did nothing.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Resolution } from "./resolve";
import { pairKey } from "./identity";

/**
 * Every resolution this family has made.
 *
 * Loaded per subject because that is what the caller has, though the answers
 * belong to the family: the same grandmother is the same grandmother in
 * every child's book, which is the point of the archive owning the memories.
 */
export async function loadResolutions(
  db: SupabaseClient,
  subjectId: string
): Promise<Resolution[]> {
  const { data: subject } = await db
    .from("subjects")
    .select("family_id")
    .eq("id", subjectId)
    .maybeSingle();
  if (!subject?.family_id) return [];

  return loadFamilyResolutions(db, subject.family_id);
}

/** The same, for callers that already know the family. */
export async function loadFamilyResolutions(
  db: SupabaseClient,
  familyId: string
): Promise<Resolution[]> {
  const { data, error } = await db
    .from("entities")
    .select("id, label, entity_aliases(key)")
    .eq("family_id", familyId)
    .is("merged_into", null);

  // A failure here must not take the weekly note with it. An archive whose
  // resolutions cannot be read is still an archive; it just does not know
  // yet that Mimi is Grandma Sue.
  if (error || !data) return [];

  return (data as any[])
    .map((e) => ({
      id: e.id as string,
      label: e.label as string,
      keys: ((e.entity_aliases ?? []) as { key: string }[]).map((a) => a.key),
    }))
    // An entity with one alias resolves nothing. Carrying it would rename a
    // thread for no reason, which is a change the family did not ask for.
    .filter((r) => r.keys.length > 1);
}

/** Pairs already ruled on, either way, as keys for identity.ts. */
export async function settledFor(db: SupabaseClient, familyId: string): Promise<string[]> {
  const { data } = await db
    .from("entity_resolutions")
    .select("pair_key")
    .eq("family_id", familyId);
  return ((data ?? []) as { pair_key: string }[]).map((r) => r.pair_key);
}

export interface Answer {
  familyId: string;
  /** Graph ids, e.g. `person:mimi`. */
  keyA: string;
  keyB: string;
  /** As the family wrote them. */
  labelA: string;
  labelB: string;
  kind: string;
  /** What they said. */
  same: boolean;
  /** Which name to keep when they are the same. Must be labelA or labelB. */
  keep?: string;
  decidedBy?: string;
}

/**
 * Record what the family said.
 *
 * A "no" writes one row and stops. A "yes" writes the row *and* builds the
 * entity — one call, because the two halves are meaningless apart.
 *
 * Returns the entity id when one was made, so a caller can say what happened
 * in the activity log without querying for it again.
 */
export async function recordAnswer(
  db: SupabaseClient,
  answer: Answer
): Promise<{ entityId: string | null }> {
  const key = pairKey(answer.keyA, answer.keyB);

  const { error: settleError } = await db.from("entity_resolutions").insert({
    family_id: answer.familyId,
    pair_key: key,
    same: answer.same,
    decided_by: answer.decidedBy ?? null,
  });
  // A unique violation means it was answered while this page was open. That
  // is a race, not a fault, and the right response is to accept the answer
  // that got there first rather than to show an error about a question the
  // family has already dealt with.
  if (settleError && !/duplicate|unique/i.test(settleError.message)) {
    throw new Error(settleError.message);
  }

  if (!answer.same) return { entityId: null };

  const label = answer.keep ?? answer.labelA;

  const { data: entity, error } = await db
    .from("entities")
    .insert({ family_id: answer.familyId, kind: answer.kind, label })
    .select("id")
    .single();
  if (error || !entity) throw new Error(error?.message ?? "could not create the entity");

  // Both names, including the one they did not choose. "Mimi" is what a
  // two-year-old called her, and it is not a spelling mistake to be tidied
  // away — see the migration.
  const { error: aliasError } = await db.from("entity_aliases").insert([
    { entity_id: entity.id, label: answer.labelA, key: answer.keyA },
    { entity_id: entity.id, label: answer.labelB, key: answer.keyB },
  ]);
  if (aliasError) throw new Error(aliasError.message);

  return { entityId: entity.id as string };
}
