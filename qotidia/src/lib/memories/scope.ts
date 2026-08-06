// Which memories a story may take.
//
// One archive, many books, and this is the whole of the difference between
// them. Everything else — clustering, questions, the graph, the weekly note,
// the book generator — reads memories through here, so there is exactly one
// answer to "is this memory part of this story" and no way for two features
// to disagree about a family's Cornwall morning.
//
// Two rules, and the second is the one that keeps the product honest.
//
// **A household's story takes the year, all of it.** A family annual is not
// the sum of its children's books; it is the year that happened, including
// the Sunday nobody was tagged in.
//
// **A person's story takes only what they were tagged in.** Not what happened
// the same afternoon, not what mentions their name in passing. Tagged, by a
// person. Anything looser is a guess about a child's life dressed as a
// record of it — and the guess would be invisible, because a photograph in
// the wrong book still looks like a photograph.
//
// The corollary, which is deliberate: an untagged memory is in the household
// book and in nobody's. That is the right default. Inferring who is in a
// photograph is the one capability this product has decided not to have.

import type { SupabaseClient } from "@supabase/supabase-js";

export interface StorySubject {
  id: string;
  family_id: string;
  subject_type: "child" | "family" | "life";
}

/** Columns every caller of the archive wants. */
export const MEMORY_COLUMNS =
  "*, memory_tags(tag), memory_people(family_members(name, nickname_used_by_child))";

export interface ScopeOptions {
  /** Only approved contributions. Books and the graph want this; queues don't. */
  approvedOnly?: boolean;
  /** Only what is still waiting on a moderator. The review queue's view. */
  pendingOnly?: boolean;
  /** Only family-visible. A private note is not material for anybody's book. */
  familyVisibleOnly?: boolean;
  /** Inclusive ISO date bounds. Undated memories are kept either way. */
  from?: string | null;
  to?: string | null;
  limit?: number;
}

/**
 * The memory ids a story may draw on, or null for "the whole household".
 *
 * Null rather than a list of every id in the archive, because a family with
 * six thousand memories should not have six thousand uuids put into a URL to
 * express "all of them".
 */
export async function memoryIdsForStory(
  db: SupabaseClient,
  subject: StorySubject
): Promise<string[] | null> {
  if (subject.subject_type === "family") return null;

  const { data } = await db
    .from("memory_subjects")
    .select("memory_id")
    .eq("subject_id", subject.id)
    .limit(20000);

  return ((data ?? []) as any[]).map((r) => r.memory_id);
}

/**
 * Everything a story may draw on.
 *
 * The family filter is applied even when the id list already implies it.
 * Belt and braces on the one query in the product where being wrong means
 * one family reading another family's year — and the cost is an indexed
 * equality check.
 */
export async function loadStoryMemories(
  db: SupabaseClient,
  subject: StorySubject,
  options: ScopeOptions = {}
): Promise<any[]> {
  const ids = await memoryIdsForStory(db, subject);
  if (ids !== null && ids.length === 0) return [];

  let q = db
    .from("memories")
    .select(MEMORY_COLUMNS)
    .eq("family_id", subject.family_id)
    .limit(options.limit ?? 4000);

  if (ids !== null) q = q.in("id", ids);
  if (options.approvedOnly) q = q.eq("contribution_status", "approved");
  if (options.familyVisibleOnly) q = q.eq("visibility", "family");

  const { data } = await q;

  const rows = ((data ?? []) as any[]).map((m) => ({
    ...m,
    tags: (m.memory_tags ?? []).map((t: any) => t.tag),
    people: (m.memory_people ?? [])
      .map((p: any) => p.family_members?.name)
      .filter(Boolean),
  }));

  // Dates are filtered here rather than in the query so that an undated
  // memory survives. It is still part of the archive and still exports; what
  // it cannot do is claim a place in a particular year's ordering.
  if (!options.from && !options.to) return rows;
  return rows.filter(
    (m) =>
      !m.memory_date ||
      ((!options.from || m.memory_date >= options.from) &&
        (!options.to || m.memory_date <= options.to))
  );
}

/**
 * Say who a memory is about.
 *
 * Idempotent, so re-tagging is safe and a retried job does not fail. Linking
 * to nobody is a legitimate outcome and is what happens by default: the
 * memory stays in the household's year and enters no child's book.
 */
export async function linkMemoryToSubjects(
  db: SupabaseClient,
  memoryId: string,
  subjectIds: string[]
): Promise<void> {
  const unique = [...new Set(subjectIds.filter(Boolean))];
  if (unique.length === 0) return;

  await db
    .from("memory_subjects")
    .upsert(
      unique.map((subject_id) => ({ memory_id: memoryId, subject_id })),
      { onConflict: "memory_id,subject_id" }
    );
}

/** How many memories a story has, without fetching them. */
export async function countStoryMemories(
  db: SupabaseClient,
  subjectId: string,
  options: ScopeOptions = {}
): Promise<number> {
  const q = await storyMemoryQuery(db, subjectId, "id", { count: "exact", head: true });
  if (!q) return 0;

  let scoped = q.query;
  if (options.approvedOnly) scoped = scoped.eq("contribution_status", "approved");
  if (options.pendingOnly) scoped = scoped.eq("contribution_status", "pending");
  if (options.familyVisibleOnly) scoped = scoped.eq("visibility", "family");

  const { count } = await scoped;
  return count ?? 0;
}

/**
 * The first dated memory in a story.
 *
 * Not the same as when anything began — it is where our records start, and
 * the difference is what stops a line claiming a rabbit arrived on the day
 * we happened to start keeping photographs of it.
 */
export async function earliestMemoryDate(
  db: SupabaseClient,
  subjectId: string
): Promise<string | null> {
  const q = await storyMemoryQuery(db, subjectId, "memory_date");
  if (!q) return null;

  const { data } = await q.query
    .eq("contribution_status", "approved")
    .not("memory_date", "is", null)
    .order("memory_date", { ascending: true })
    .limit(1);

  return ((data ?? []) as any[])[0]?.memory_date ?? null;
}

/** The subject, with everything the scoping rules need and nothing else. */
export async function storySubject(
  db: SupabaseClient,
  subjectId: string
): Promise<StorySubject | null> {
  const { data } = await db
    .from("subjects")
    .select("id, family_id, subject_type")
    .eq("id", subjectId)
    .maybeSingle();
  return (data as StorySubject) ?? null;
}

/**
 * Keep a memory, and say who it is about.
 *
 * Every capture path goes through this — the uploader, the recorder, the
 * quick sheet, an answered question, the share sheet, the address. Five
 * inserts each remembering to set a family and write a link is five places
 * for one of them to forget, and the one that forgets produces a memory in
 * nobody's book that still counts in every total.
 *
 * `about` is normally the subject whose page somebody was on. Empty is a
 * legitimate answer and means the household: the memory is in the family's
 * year and in no individual's book, which is the right default when nobody
 * has said who is in it.
 */
export async function keepMemory(
  db: SupabaseClient,
  input: { familyId: string; about?: string[]; memory: Record<string, any> }
): Promise<string | null> {
  const { data, error } = await db
    .from("memories")
    .insert({ ...input.memory, family_id: input.familyId })
    .select("id")
    .single();

  if (error || !data) return null;
  await linkMemoryToSubjects(db, data.id, input.about ?? []);
  return data.id;
}

/**
 * A query over exactly the memories a story may draw on.
 *
 * Returned half-built so a caller can add its own ordering, limits and
 * columns without this module having to know about every screen. The
 * important half — the family, and the tagging rule — is already applied and
 * cannot be forgotten.
 *
 * Null means "there is nothing", for either reason: no such subject, or a
 * person nobody has been tagged in yet. Both are empty to every caller, and
 * distinguishing them at each call site would be ceremony without a use.
 */
export async function storyMemoryQuery(
  db: SupabaseClient,
  subjectId: string,
  select: string,
  opts?: { count?: "exact"; head?: boolean }
): Promise<{ query: any } | null> {
  const story = await storySubject(db, subjectId);
  if (!story) return null;

  const ids = await memoryIdsForStory(db, story);
  if (ids !== null && ids.length === 0) return null;

  let q = db.from("memories").select(select, opts as any).eq("family_id", story.family_id);
  if (ids !== null) q = q.in("id", ids);

  // Wrapped, and this is not decoration. A PostgREST builder is thenable, so
  // returning one straight out of an async function makes the runtime await
  // it — the caller gets `{ data, error }` where it expected a query, and
  // every `.eq()` it tried to add afterwards threw. The wrapper is not
  // thenable, so the builder arrives intact.
  return { query: q };
}

/** The most recent things kept for a story, newest first. */
export async function recentStoryMemories(
  db: SupabaseClient,
  subjectId: string,
  limit = 5
): Promise<any[]> {
  const q = await storyMemoryQuery(db, subjectId, "id, type, raw_text, memory_date, created_at");
  if (!q) return [];
  const { data } = await q.query.order("created_at", { ascending: false }).limit(limit);
  return (data ?? []) as any[];
}

/** Arrivals still carrying an open question. Almost always zero. */
export async function countUnfiled(db: SupabaseClient, subjectId: string): Promise<number> {
  const q = await storyMemoryQuery(db, subjectId, "id", { count: "exact", head: true });
  if (!q) return 0;
  const { count } = await q.query.is("filed_at", null).not("arrived_via", "is", null);
  return count ?? 0;
}
