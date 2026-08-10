// The context answers, in the database.
//
// Two queries and no judgement. Which question is worth asking is decided in
// context.ts, which is pure and tested without a database.

import type { SupabaseClient } from "@supabase/supabase-js";
import { questionKey, type Settled, type Wondering } from "./context";

/**
 * Every question this family has settled, answered or declined.
 *
 * Both, deliberately. A declined question is as settled as an answered one —
 * re-asking something somebody chose not to answer is worse than never
 * asking, because it says nobody was listening.
 */
export async function settledContext(
  db: SupabaseClient,
  familyId: string
): Promise<Settled> {
  const { data } = await db
    .from("entity_context")
    .select("entity_key, wondering")
    .eq("family_id", familyId);

  return new Set(
    (data ?? []).map((row: any) => questionKey(row.entity_key, row.wondering as Wondering))
  );
}

/** What the family has said, for the pages that show it back. */
export interface KnownContext {
  entityKey: string;
  wondering: Wondering;
  answer: string | null;
  because: string | null;
  createdAt: string;
}

export async function knownContext(
  db: SupabaseClient,
  familyId: string
): Promise<KnownContext[]> {
  const { data } = await db
    .from("entity_context")
    .select("entity_key, wondering, answer, because, created_at")
    .eq("family_id", familyId)
    .eq("skipped", false)
    .order("created_at", { ascending: false });

  return (data ?? []).map((row: any) => ({
    entityKey: row.entity_key,
    wondering: row.wondering,
    answer: row.answer,
    because: row.because,
    createdAt: row.created_at,
  }));
}

/**
 * Record what they said, or that they would rather not.
 *
 * A duplicate is treated as a race rather than a fault: two tabs open on the
 * same question is a person answering once, and the second write losing is
 * the correct outcome.
 */
export async function recordContext(
  db: SupabaseClient,
  input: {
    familyId: string;
    entityKey: string;
    wondering: Wondering;
    answer: string | null;
    because: string | null;
    userId: string;
  }
): Promise<void> {
  const answer = input.answer?.trim() || null;
  const { error } = await db.from("entity_context").insert({
    family_id: input.familyId,
    entity_key: input.entityKey,
    wondering: input.wondering,
    answer,
    skipped: answer === null,
    because: input.because,
    answered_by: input.userId,
  });

  if (error && (error as any).code !== "23505") throw new Error(error.message);
}
