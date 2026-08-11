// Which people in this archive are books.
//
// Four reads and no judgement — every decision is in person-story.ts, which
// is pure and tested without a database.
//
// The one thing worth explaining is what "confirmed" means, because it is
// the gate on the whole feature. A person is offered as a book when the
// family has told us who they are, and there are two ways that happens:
// they resolved two names into one on the who's-who page, or they entered
// the person as a family member themselves. Both are somebody typing; the
// third possibility — a name the graph found in free text and nobody has
// ever confirmed — is not a person we will print a book about.

import type { SupabaseClient } from "@supabase/supabase-js";
import { loadEntities, memoriesWithWords } from "@/lib/graph/extract";
import { loadFamilyResolutions } from "@/lib/graph/identity-store";
import { peopleWorthABook, type PersonStory } from "./person-story";

export async function peopleBooksFor(
  db: SupabaseClient,
  subjectId: string
): Promise<PersonStory[]> {
  const { data: subject } = await db
    .from("subjects")
    .select("family_id")
    .eq("id", subjectId)
    .maybeSingle();
  if (!subject?.family_id) return [];

  const [entities, wordy, resolutions, members] = await Promise.all([
    loadEntities(db, subjectId),
    memoriesWithWords(db, subjectId),
    loadFamilyResolutions(db, subject.family_id),
    db.from("family_members").select("name").eq("family_id", subject.family_id),
  ]);

  // Siblings are people the family entered too — they are subjects rather
  // than family members, which is a distinction in our schema and none at
  // all to a child. Without this the picker asked who Theo was.
  const { data: siblings } = await db
    .from("subjects")
    .select("display_name")
    .eq("family_id", subject.family_id)
    .eq("subject_type", "child");

  // Resolved entities carry a uuid; a family member the graph found carries
  // `person:Name`. Both count as confirmed, and both are somebody typing.
  const confirmed = new Set<string>(resolutions.map((r) => r.id));
  for (const m of ((members.data ?? []) as { name: string }[])) {
    // Lowercased, because buildEntities lowercases the key when it builds
    // the id — `person:tom`, not `person:Tom`. Without this the set never
    // matched, and the picker told a family we did not know who Grandpa was
    // about a person they had entered themselves. Found by reading the page,
    // not by the types: both sides are strings and both were plausible.
    confirmed.add(`person:${m.name.toLowerCase().trim()}`);
  }

  for (const sib of ((siblings ?? []) as { display_name: string }[])) {
    confirmed.add(`person:${sib.display_name.toLowerCase().trim()}`);
  }

  const people = entities.filter((e) => e.kind === "person");
  return peopleWorthABook(people, wordy, confirmed);
}
