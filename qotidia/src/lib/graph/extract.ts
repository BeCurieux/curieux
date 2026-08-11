// Turning an archive into entities.
//
// Everything here comes from something a person did: named someone, tagged a
// photograph, confirmed a cluster, or wrote down a little thing. Nothing is
// inferred from an image. That is a deliberate ceiling on how clever this can
// be, and it is the right ceiling — a graph assembled from what a family
// typed is one they would be comfortable reading about, and a graph
// assembled from faces is one they would not.
//
// Split in two on purpose: buildEntities is pure and holds every decision
// worth arguing about, loadEntities is four queries and no judgement.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Entity, EntityKind, Mention } from "./presence";
import { asSaid, runsIn } from "./phrases";
import { firstLook, type FirstLook } from "./first-look";
import { countStoryMemories, earliestMemoryDate, storyMemoryQuery } from "@/lib/memories/scope";
import { applyResolutions } from "./resolve";
import { loadResolutions } from "./identity-store";

export interface RawMention {
  memoryId: string;
  /** Null for an undated memory, which cannot contribute to a shape. */
  date: string | null;
  kind: EntityKind;
  /** Stable identity. Lowercased, so "Bun Bun" and "bun bun" are one thing. */
  key: string;
  /** As the family wrote it, for display. */
  label: string;
}

/**
 * Below this, an entity is a coincidence rather than a thread.
 *
 * Two mentions of a word is two mentions of a word. It is the third that
 * makes it a thing about this family, and the difference matters because
 * every entity here is a candidate for something we say out loud.
 */
export const MIN_MENTIONS = 3;

/**
 * How much two entities have to overlap before they are one thing.
 *
 * A confirmed cluster is almost always built over a tag, so `thing:bun_bun`
 * and `ritual:Bun Bun` cover the same memories and are the same rabbit. Left
 * alone they produce two nearly identical lines in the same weekly note,
 * which is the fastest way to make something that is paying attention look
 * like something that is pattern-matching.
 */
const SAME_THREAD = 0.8;

/**
 * Which label survives a merge.
 *
 * A cluster title and a person's name were written as names; a tag was
 * written as a filing label. Given "Bun Bun" and "bun bun" for the same five
 * memories, the family typed both, and the one they typed as a name is the
 * one to say out loud.
 */
const RANK: Record<EntityKind, number> = { person: 4, ritual: 3, place: 2, phrase: 1, thing: 0 };

function overlap(a: Entity, b: Entity): number {
  const ids = new Set(a.mentions.map((m) => m.memoryId));
  const shared = b.mentions.filter((m) => ids.has(m.memoryId)).length;
  return shared / Math.min(a.mentions.length, b.mentions.length);
}

/**
 * Collapse entities that are the same thread under two names.
 *
 * Merges mentions rather than discarding the loser, so a cluster missing one
 * tagged photograph does not cost that photograph its place in the count.
 */
function mergeDuplicates(entities: Entity[]): Entity[] {
  const kept: Entity[] = [];

  for (const candidate of entities) {
    const twin = kept.find((k) => sameThread(k, candidate));
    if (!twin) {
      kept.push(candidate);
      continue;
    }

    const byId = new Map(twin.mentions.map((m) => [m.memoryId, m]));
    for (const m of candidate.mentions) byId.set(m.memoryId, m);
    twin.mentions = [...byId.values()];

    if (winner(candidate, twin)) {
      twin.id = candidate.id;
      twin.kind = candidate.kind;
      twin.label = candidate.label;
    }
  }

  return kept;
}

/**
 * Whether two entities are the same thread under two names.
 *
 * Across kinds, near-total overlap is enough — a cluster and the tag it was
 * built over. Within a kind the bar is exact, because "beach" and "summer"
 * on eight of the same nine photographs are two real threads that happen to
 * travel together, and only an identical set makes them one thing. That
 * exactness is what collapses the runs of words a phrase produces: "I do
 * it", "do it" and "I do" come out of the same three quotes and nothing
 * else, so they are one phrase.
 */
function sameThread(a: Entity, b: Entity): boolean {
  if (a.kind !== b.kind) return overlap(a, b) >= SAME_THREAD;
  return a.mentions.length === b.mentions.length && overlap(a, b) === 1;
}

/** Whose name the merged entity takes. */
function winner(candidate: Entity, incumbent: Entity): boolean {
  if (candidate.kind !== incumbent.kind) return RANK[candidate.kind] > RANK[incumbent.kind];
  // Same kind, same memories: the fuller phrase. "I do it my byself" is the
  // thing the family would recognise; "do it" is a fragment of it.
  return candidate.label.length > incumbent.label.length;
}

/**
 * Group raw mentions into entities.
 *
 * Keyed case-insensitively and de-duplicated per memory: a photograph tagged
 * "bun bun" and also linked to a cluster called "Bun Bun" is one appearance
 * of the rabbit, not two. Without that, anything the clustering liked gets
 * double-counted and every observation about it is inflated.
 */
export function buildEntities(rows: RawMention[]): Entity[] {
  const byKey = new Map<string, { label: string; kind: EntityKind; mentions: Map<string, Mention> }>();

  for (const row of rows) {
    if (!row.date) continue;
    const key = row.key.toLowerCase().trim();
    if (!key) continue;
    const id = `${row.kind}:${key}`;
    const existing = byKey.get(id);
    if (existing) {
      // Map keyed by memory id, so the same memory cannot count twice.
      existing.mentions.set(row.memoryId, { memoryId: row.memoryId, date: row.date });
    } else {
      byKey.set(id, {
        label: row.label.trim(),
        kind: row.kind,
        mentions: new Map([[row.memoryId, { memoryId: row.memoryId, date: row.date }]]),
      });
    }
  }

  const entities = [...byKey.entries()]
    .map(([id, e]) => ({ id, kind: e.kind, label: e.label, mentions: [...e.mentions.values()] }))
    .filter((e) => e.mentions.length >= MIN_MENTIONS)
    .sort((a, b) => b.mentions.length - a.mentions.length);

  return mergeDuplicates(entities).sort((a, b) => b.mentions.length - a.mentions.length);
}

/**
 * Read a subject's entities out of the database.
 *
 * Only approved, family-visible memories. The graph must not be a way for a
 * private note or an unapproved contribution to become an observation
 * everyone in the family reads on a Sunday morning.
 */
export async function loadEntities(db: SupabaseClient, subjectId: string): Promise<Entity[]> {
  const scoped = await storyMemoryQuery(
    db,
    subjectId,
    "id, type, memory_date, raw_text, transcript, location, memory_tags(tag), memory_people(family_members(name, nickname_used_by_child)), memory_subjects(subjects(id, display_name))"
  );
  const { data: memories } = scoped
    ? await scoped.query
        .eq("contribution_status", "approved")
        .eq("visibility", "family")
        .not("memory_date", "is", null)
        .limit(4000)
    : { data: [] };

  const rows: RawMention[] = [];

  for (const m of (memories ?? []) as any[]) {
    for (const t of m.memory_tags ?? []) {
      if (!t.tag) continue;
      rows.push({
        memoryId: m.id,
        date: m.memory_date,
        // Tags carry no type, so they are things. A tag that is really a
        // ritual is still a thread worth following; miscalling it costs a
        // slightly odd noun in one sentence, and pretending to know would
        // cost more.
        kind: "thing",
        key: t.tag,
        label: String(t.tag).replace(/_/g, " "),
      });
    }

    for (const p of m.memory_people ?? []) {
      const name = p.family_members?.name;
      if (!name) continue;
      rows.push({
        memoryId: m.id,
        date: m.memory_date,
        kind: "person",
        // Keyed on the name, which is stable, and shown as whatever the
        // child calls them, which is the archive's whole point of view. A
        // line about this family's year should say Grandpa, not Margaret.
        key: name,
        label: p.family_members?.nickname_used_by_child?.trim() || name,
      });
    }

    // Siblings. A brother in half your photographs is a person in your life,
    // and until the archive belonged to the family there was no way for the
    // graph to know that — a second child was a separate archive. Skipping
    // the subject whose story this is, because "Florence turns up most
    // Thursdays" in Florence's own book is not an observation.
    for (const link of m.memory_subjects ?? []) {
      const sibling = link.subjects;
      if (!sibling?.display_name || sibling.id === subjectId) continue;
      rows.push({
        memoryId: m.id,
        date: m.memory_date,
        kind: "person",
        key: sibling.display_name,
        label: sibling.display_name,
      });
    }

    // Places are the one kind we do not have to infer: the parent typed it
    // into a field called location.
    if (typeof m.location === "string" && m.location.trim()) {
      rows.push({
        memoryId: m.id,
        date: m.memory_date,
        kind: "place",
        key: m.location,
        label: m.location.trim(),
      });
    }

    // Phrases, and only from things the child was recorded as saying. A
    // parent's note about a phrase is the parent's sentence — putting it in
    // quotation marks and attributing it to a three-year-old would be the
    // product inventing a memory, which is the one thing it may never do.
    if (m.type === "quote" || m.type === "voice") {
      const said = (m.transcript ?? m.raw_text ?? "") as string;
      for (const run of runsIn(said)) {
        rows.push({
          memoryId: m.id,
          date: m.memory_date,
          kind: "phrase",
          key: run,
          label: asSaid(run, said),
        });
      }
    }
  }

  // Confirmed clusters only. A suggested cluster is our guess; a confirmed
  // one is the family agreeing it is a real thread, which is the standard
  // everything in this module is held to.
  const { data: clusters } = await db
    .from("memory_clusters")
    .select("title, cluster_memories(memory_id)")
    .eq("subject_id", subjectId)
    .eq("status", "confirmed");

  const dateOf = new Map<string, string>(
    ((memories ?? []) as any[]).map((m) => [m.id, m.memory_date])
  );
  for (const c of (clusters ?? []) as any[]) {
    for (const cm of c.cluster_memories ?? []) {
      const date = dateOf.get(cm.memory_id);
      if (!date) continue;
      rows.push({ memoryId: cm.memory_id, date, kind: "ritual", key: c.title, label: c.title });
    }
  }

  // The last step, and the only one that consults something a person told
  // us rather than something they tagged. Two names for one grandmother stop
  // being two threads here — see lib/graph/resolve.ts.
  const built = buildEntities(rows);
  return applyResolutions(built, await loadResolutions(db, subjectId));
}

/**
 * Memories that carry any words at all.
 *
 * Gap detection needs this: a person in forty photographs and one sentence
 * is the case worth asking about, and it cannot be spotted without knowing
 * which memories were written on.
 */
/**
 * What we noticed, on first sight of this archive.
 *
 * One function so the screen is four lines: everything it needs comes from
 * the same three reads the weekly note already does.
 */
export async function loadFirstLook(
  db: SupabaseClient,
  subjectId: string
): Promise<FirstLook> {
  const [entities, words, count, { data: subject }, earliest] = await Promise.all([
    loadEntities(db, subjectId),
    memoriesWithWords(db, subjectId),
    countStoryMemories(db, subjectId, { approvedOnly: true }),
    db.from("subjects").select("date_of_birth, pronouns").eq("id", subjectId).maybeSingle(),
    // Where our records start, which is not where anything started. The
    // difference decides whether a line may say "beginning when she was
    // fourteen months old" or has to say what it actually saw.
    earliestMemoryDate(db, subjectId),
  ]);

  return firstLook({
    entities,
    memoriesWithWords: words,
    memoryCount: count,
    dateOfBirth: subject?.date_of_birth ?? null,
    pronouns: subject?.pronouns ?? null,
    archiveStart: earliest,
  });
}

export async function memoriesWithWords(db: SupabaseClient, subjectId: string): Promise<Set<string>> {
  const scoped = await storyMemoryQuery(db, subjectId, "id, raw_text, transcript");
  const { data } = scoped
    ? await scoped.query.eq("contribution_status", "approved").limit(4000)
    : { data: [] };

  return new Set(
    ((data ?? []) as any[])
      .filter((m) => (m.raw_text ?? m.transcript ?? "").trim().length > 0)
      .map((m) => m.id)
  );
}
