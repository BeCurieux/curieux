// Who is in it.
//
// A family taps a name. Behind the name are two different tables and one of
// the more consequential distinctions in the product, and they should never
// have to learn either.
//
//   Florence and Theo are **subjects**. They have books. Tagging one decides
//   which annual a photograph can appear in.
//
//   Grandpa and Mum are **family members**. They appear in the archive and
//   in chapters about the people in a child's life, but no book is about
//   them, so tagging one changes what the book says and not which book it is.
//
// Making a parent choose between those two ideas would be making them do the
// data modelling. So this presents one list of everybody, in the order a
// family thinks of them, and routes each tap to the right table.
//
// The rule underneath is the one already agreed: a memory tagged with nobody
// belongs to the household and to no individual's book. That is why this is
// worth a screen at all. Nothing infers who is in a photograph, so the only
// way a Cornwall morning reaches two children's books is if somebody says so
// — and if saying so is slow, nobody will, and the archive quietly becomes
// one book's worth of material with a lot of untagged photographs beside it.

import type { SupabaseClient } from "@supabase/supabase-js";

export type WhoKind = "subject" | "member";

export interface Person {
  /** Prefixed, so one list of chips can carry both kinds without ambiguity. */
  key: string;
  kind: WhoKind;
  id: string;
  /** What the family calls them. */
  name: string;
  /** "Grandpa", "Mum" — shown under the name when it adds something. */
  relationship: string | null;
  /** Whether this person has a book of their own. */
  hasBook: boolean;
}

export const keyFor = (kind: WhoKind, id: string) => `${kind}:${id}`;

export function parseKey(key: string): { kind: WhoKind; id: string } | null {
  const [kind, ...rest] = key.split(":");
  const id = rest.join(":");
  if (!id) return null;
  if (kind !== "subject" && kind !== "member") return null;
  return { kind, id };
}

/**
 * Everybody a memory could be about, in the order a family thinks of them.
 *
 * Children first, because they are who most photographs are of and because
 * tagging one is the tap that actually changes which book a memory reaches.
 * Everyone else after, by relationship then name, so the list is stable
 * between visits — a chip row that reorders itself is a chip row people
 * mis-tap.
 */
export async function peopleInFamily(
  db: SupabaseClient,
  familyId: string
): Promise<Person[]> {
  const [{ data: subjects }, { data: members }] = await Promise.all([
    db
      .from("subjects")
      .select("id, display_name, subject_type")
      .eq("family_id", familyId)
      .order("created_at"),
    db
      .from("family_members")
      .select("id, name, relationship")
      .eq("family_id", familyId)
      .order("created_at"),
  ]);

  const people: Person[] = ((subjects ?? []) as any[])
    // The household is not a person and cannot be in a photograph. It is a
    // book, and everything in the archive is already in it.
    .filter((s) => s.subject_type !== "family")
    .map((s) => ({
      key: keyFor("subject", s.id),
      kind: "subject" as const,
      id: s.id,
      name: s.display_name,
      relationship: null,
      hasBook: true,
    }));

  for (const m of (members ?? []) as any[]) {
    people.push({
      key: keyFor("member", m.id),
      kind: "member",
      id: m.id,
      name: m.name,
      relationship: m.relationship ?? null,
      hasBook: false,
    });
  }

  return people;
}

/**
 * Who each memory is already tagged with.
 *
 * Both tables in one read, keyed the same way the chips are, so a screen
 * rendering fifty photographs does two queries rather than a hundred.
 */
export async function whoIsIn(
  db: SupabaseClient,
  memoryIds: string[]
): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>();
  if (memoryIds.length === 0) return out;

  const add = (memoryId: string, key: string) => {
    if (!out.has(memoryId)) out.set(memoryId, new Set());
    out.get(memoryId)!.add(key);
  };

  const [{ data: subjectLinks }, { data: memberLinks }] = await Promise.all([
    db.from("memory_subjects").select("memory_id, subject_id").in("memory_id", memoryIds),
    db.from("memory_people").select("memory_id, family_member_id").in("memory_id", memoryIds),
  ]);

  for (const l of (subjectLinks ?? []) as any[]) add(l.memory_id, keyFor("subject", l.subject_id));
  for (const l of (memberLinks ?? []) as any[]) add(l.memory_id, keyFor("member", l.family_member_id));

  return out;
}

/**
 * Add or remove one person from one memory.
 *
 * A toggle rather than a form with a save button. Tagging forty photographs
 * is forty small decisions, and anything that asks somebody to confirm each
 * one is something they will do for six photographs and then stop.
 */
export async function toggleWho(
  db: SupabaseClient,
  memoryId: string,
  key: string
): Promise<void> {
  const who = parseKey(key);
  if (!who) return;

  const table = who.kind === "subject" ? "memory_subjects" : "memory_people";
  const column = who.kind === "subject" ? "subject_id" : "family_member_id";

  const { data: existing } = await db
    .from(table)
    .select(column)
    .eq("memory_id", memoryId)
    .eq(column, who.id)
    .maybeSingle();

  if (existing) {
    await db.from(table).delete().eq("memory_id", memoryId).eq(column, who.id);
    return;
  }

  await db.from(table).insert({ memory_id: memoryId, [column]: who.id });
}

/**
 * How much of an archive has nobody's name on it.
 *
 * Two plain counts rather than a left join with a null filter on an embedded
 * resource. That form exists in PostgREST and is exactly the kind of query
 * that works until the day it is asked something slightly different, and it
 * is being used here for a number on a dashboard.
 *
 * Untagged is not a failure — those memories are in the household's year,
 * which is the rule. It is worth surfacing because it is the one thing
 * standing between a family and a second book.
 */
export async function countUntagged(
  db: SupabaseClient,
  familyId: string
): Promise<number> {
  const { count: total } = await db
    .from("memories")
    .select("id", { count: "exact", head: true })
    .eq("family_id", familyId)
    .eq("contribution_status", "approved");

  if (!total) return 0;

  const { data: subjects } = await db
    .from("subjects")
    .select("id")
    .eq("family_id", familyId);

  const subjectIds = ((subjects ?? []) as any[]).map((s) => s.id);
  if (subjectIds.length === 0) return total;

  const { data: links } = await db
    .from("memory_subjects")
    .select("memory_id")
    .in("subject_id", subjectIds)
    .limit(50000);

  // Distinct, because a Cornwall morning tagged with both children is one
  // tagged memory and would otherwise count as two.
  const tagged = new Set(((links ?? []) as any[]).map((l) => l.memory_id));
  return Math.max(0, total - tagged.size);
}
