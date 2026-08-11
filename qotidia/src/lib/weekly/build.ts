// The weekly note.
//
// Thirty seconds, three lines, and the feeling that something is paying
// attention so the parent does not have to. Everything hard about it is in
// the graph; this is assembly plus two judgements — whether there is
// anything worth saying at all, and when to say something else.
//
// The first judgement matters more than the assembly. A note that arrives
// every week whether or not there is anything in it is a note that gets
// filtered within a month, and once filtered it never comes back. Silence is
// a feature here, and the code has to be willing to produce it.
//
// The second is why this file writes to the database at all. A note is
// **written once and then read**, not recomputed on every page view. Three
// reasons, and the first is a bug this had:
//
//   - Recomputing meant every visit recorded another three rows, and the
//     rotation that reads those rows then hid the note from the family on
//     their second visit of the same Sunday.
//   - The sentence has to hold still. A family that reads "The dinosaur hat,
//     4 times this week" and comes back after uploading two more should not
//     find it silently changed to six.
//   - Keep and Ignore point at a row. They cannot point at something that is
//     regenerated underneath them.

import type { SupabaseClient } from "@supabase/supabase-js";
import { loadEntities, memoriesWithWords } from "@/lib/graph/extract";
import { gapsWorthAsking, noticeThisWeek, type Gap, type Observation } from "@/lib/graph/notice";
import { todayIso } from "@/lib/lookback/load";

export interface WeeklyNote {
  observations: Observation[];
  /** At most one, so the note never becomes a questionnaire. */
  gap: Gap | null;
  /** False when there is nothing worth anyone's attention. */
  worthShowing: boolean;
}

export interface ShownNote {
  observations: Observation[];
  /** The one question, already worded. Null on most weeks. */
  question: string | null;
  worthShowing: boolean;
  /** Row ids, in the same order as the observations, for answering. */
  shownIds: string[];
}

/** How long an entity rests after being mentioned, so weeks do not repeat. */
export const REST_DAYS = 28;

/** How long one note stands before another is built. */
export const NOTE_LIVES_DAYS = 7;

/**
 * Shapes that are not observations.
 *
 * The question is stored beside the lines so a standing note is one read
 * rather than five, and `none` records the weeks where we looked and found
 * nothing — which is most weeks, and which is worth not recomputing on every
 * visit to the archive.
 */
const QUESTION = "gap";
const NOTHING = "none";

const daysBefore = (today: string, days: number) =>
  new Date(Date.parse(`${today}T00:00:00Z`) - days * 86_400_000).toISOString();

/**
 * Build the week's observations, without writing anything.
 *
 * Kept separate from the persistence so the interesting half can be read and
 * tested without a database in the way.
 */
export async function buildWeeklyNote(
  db: SupabaseClient,
  subjectId: string,
  today = todayIso()
): Promise<WeeklyNote> {
  const entities = await loadEntities(db, subjectId);
  const skip = await restingEntities(db, subjectId, today);

  const observations = noticeThisWeek({ entities, today, recentlyShown: skip });

  const words = await memoriesWithWords(db, subjectId);
  const gaps = gapsWorthAsking({ entities, memoriesWithWords: words });
  const gap = gaps.find((g) => !skip.includes(g.entityId)) ?? null;

  return {
    observations,
    gap,
    worthShowing: observations.length > 0 || gap !== null,
  };
}

/**
 * Entities that should not be spoken about right now.
 *
 * Two different silences. One is a rotation — said recently, say something
 * else — and it lifts. The other is the family telling us we were wrong, and
 * that one is permanent: being corrected and repeating yourself a month later
 * is worse than never having said it.
 */
async function restingEntities(
  db: SupabaseClient,
  subjectId: string,
  today: string
): Promise<string[]> {
  const { data: recent } = await db
    .from("noticed")
    .select("entity_id")
    .eq("subject_id", subjectId)
    .gte("shown_at", daysBefore(today, REST_DAYS));

  const { data: ignored } = await db
    .from("noticed")
    .select("entity_id")
    .eq("subject_id", subjectId)
    .eq("verdict", "ignored");

  return [
    ...((recent ?? []) as any[]).map((r) => r.entity_id),
    ...((ignored ?? []) as any[]).map((r) => r.entity_id),
  ];
}

/**
 * This week's note, written the first time it is asked for and read after.
 *
 * `write` is a service-role client because the rows are ours: a family may
 * answer an observation but does not author one, and the table's policies say
 * so. Passing null gives the read-only path — what a viewer without edit
 * rights gets. They see the note; they do not start its clock.
 */
export async function weeklyNoteFor(
  db: SupabaseClient,
  subjectId: string,
  opts: { write: SupabaseClient | null; today?: string }
): Promise<ShownNote> {
  const today = opts.today ?? todayIso();

  const { data } = await db
    .from("noticed")
    .select("id, entity_id, line, shape, memory_ids, verdict")
    .eq("subject_id", subjectId)
    .gte("shown_at", daysBefore(today, NOTE_LIVES_DAYS))
    .order("shown_at", { ascending: true });

  const standing = (data ?? []) as any[];
  if (standing.length > 0) return readStanding(standing);

  const note = await buildWeeklyNote(db, subjectId, today);
  if (!opts.write) {
    return {
      observations: note.observations,
      question: note.gap?.question ?? null,
      worthShowing: note.worthShowing,
      shownIds: [],
    };
  }

  const { data: written } = await opts.write
    .from("noticed")
    .insert(rowsFor(subjectId, note))
    .select("id, entity_id, line, shape, memory_ids, verdict");

  return readStanding((written ?? []) as any[]);
}

/** A built note as rows. Includes the empty week, so we only look once. */
export function rowsFor(subjectId: string, note: WeeklyNote) {
  const base = {
    subject_id: subjectId,
    // Written rather than left to the column default, so the timestamp this
    // code reasons about is the one it wrote.
    shown_at: new Date().toISOString(),
  };

  // `shape` is a column, not the Shape union: the question and the empty week
  // are rows too, and they are not shapes an entity can be in.
  interface Row {
    subject_id: string;
    shown_at: string;
    entity_id: string;
    line: string;
    shape: string;
    memory_ids: string[];
  }

  const rows: Row[] = note.observations.map((o) => ({
    ...base,
    entity_id: o.entityId,
    line: o.line,
    shape: o.shape as string,
    memory_ids: o.memoryIds,
  }));

  if (note.gap) {
    rows.push({
      ...base,
      entity_id: note.gap.entityId,
      line: note.gap.question,
      shape: QUESTION,
      memory_ids: [],
    });
  }

  if (rows.length === 0) {
    // A week with nothing in it. Recorded because "we looked and there was
    // nothing" is a fact, and because without it the quietest families pay
    // for a full re-derivation of the graph on every page they open.
    rows.push({ ...base, entity_id: `${NOTHING}:${base.shown_at.slice(0, 10)}`, line: "", shape: NOTHING, memory_ids: [] });
  }

  return rows;
}

/**
 * A standing note, as the family should see it now.
 *
 * Ignored lines drop out immediately. That is the one place a note is allowed
 * to change under the family mid-week, because they are the ones who changed
 * it — a line you have just told us was wrong should not still be sitting
 * there when the page reloads.
 */
export function readStanding(rows: any[]): ShownNote {
  const live = rows.filter((r) => r.verdict !== "ignored");

  const said = live.filter((r) => r.shape !== QUESTION && r.shape !== NOTHING);

  const observations: Observation[] = said.map((r) => ({
    entityId: r.entity_id,
    kind: (r.entity_id.split(":")[0] ?? "thing") as Observation["kind"],
    shape: r.shape,
    line: r.line,
    memoryIds: (r.memory_ids ?? []) as string[],
    // Row order is the order they were ranked in when the note was built.
    // There is nothing left to sort, so there is nothing left to weigh.
    weight: 0,
  }));

  const question = live.find((r) => r.shape === QUESTION)?.line ?? null;

  return {
    observations,
    question,
    worthShowing: observations.length > 0 || question !== null,
    shownIds: said.map((r) => r.id),
  };
}
