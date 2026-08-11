// The weekly note, as a thing that is written once and then read.
//
// The bug these exist for: the note was rebuilt on every page view, which
// recorded another set of rows each time — and the rotation that reads those
// rows then hid the note from the family on their second visit of the same
// Sunday. It rendered perfectly on the first load, which is exactly why it
// survived a screenshot.

import { describe, expect, it } from "vitest";
import {
  NOTE_LIVES_DAYS,
  readStanding,
  rowsFor,
  weeklyNoteFor,
  type WeeklyNote,
} from "@/lib/weekly/build";
import type { Observation } from "@/lib/graph/notice";

const TODAY = "2026-08-06";

const observation = (over: Partial<Observation> = {}): Observation => ({
  entityId: "thing:bun bun",
  kind: "thing",
  shape: "faded",
  line: "Bun Bun hasn't appeared since April.",
  memoryIds: ["m1", "m2"],
  weight: 105,
  ...over,
});

const note = (over: Partial<WeeklyNote> = {}): WeeklyNote => ({
  observations: [observation()],
  gap: null,
  worthShowing: true,
  ...over,
});

/**
 * Just enough Supabase to run the note.
 *
 * Records every query so the tests can assert on how many writes happened,
 * which is the whole point — the failure being guarded against is invisible
 * in the output and only visible in the number of rows.
 */
function fakeDb(rows: any[] = [], memories: any[] = []) {
  const writes: any[][] = [];
  // The archive owns the memories now, so anything reading them first asks
  // which family and which subjects — a fake that stops at `memories` no
  // longer reaches the code under test.
  const subject = { id: "s1", family_id: "f1", subject_type: "child" };
  const links = () => memories.map((m) => ({ memory_id: m.id, subject_id: "s1" }));

  const client: any = {
    rows,
    writes,
    from(table: string) {
      const q: any = {
        _rows:
          table === "noticed" ? rows
          : table === "entities" ? []
          : table === "entity_resolutions" ? []
          : table === "subjects" ? [subject]
          : table === "memory_subjects" ? links()
          : memories,
        select(_cols?: string) { return q; },
        eq(col: string, val: any) { q._rows = q._rows.filter((r: any) => r[col] === val); return q; },
        gte() { return q; },
        in(col: string, vals: any[]) { q._rows = q._rows.filter((r: any) => vals.includes(r[col])); return q; },
        not() { return q; },
        // The graph now reads the family's resolutions on its way out, and
        // that query filters on `merged_into is null`. A fake that stops
        // short of the real client's surface fails the caller rather than
        // the thing under test.
        is(col: string, val: any) { q._rows = q._rows.filter((r: any) => (r[col] ?? null) === val); return q; },
        order() { return q; },
        limit() { return q; },
        insert(payload: any[]) {
          writes.push(payload);
          const written = payload.map((r, i) => ({ id: `row-${rows.length + i}`, verdict: "shown", ...r }));
          rows.push(...written);
          return { select: () => Promise.resolve({ data: written, error: null }) };
        },
        maybeSingle: () => Promise.resolve({ data: q._rows[0] ?? null, error: null }),
        then: (res: any) => Promise.resolve({ data: q._rows, error: null }).then(res),
      };
      return q;
    },
  };
  return client;
}

const ago = (days: number) =>
  new Date(Date.parse(`${TODAY}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);

/** An archive with one real thing in it: a hat, four times this week. */
const hatArchive = () =>
  [1, 2, 4, 6, 30, 38].map((d, i) => ({
    id: `m${i}`,
    family_id: "f1",
    memory_date: ago(d),
    raw_text: "Hat, park, hat.",
    contribution_status: "approved",
    visibility: "family",
    memory_tags: [{ tag: "the dinosaur hat" }],
    memory_people: [],
  }));

describe("this week's note", () => {
  it("is written once and read after, however many times the page is opened", async () => {
    const db = fakeDb([], hatArchive());
    const first = await weeklyNoteFor(db, "s1", { write: db, today: TODAY });
    const second = await weeklyNoteFor(db, "s1", { write: db, today: TODAY });
    const third = await weeklyNoteFor(db, "s1", { write: db, today: TODAY });

    // One write, three identical notes. Before this, each view wrote again
    // and the rotation reading those rows blanked the note on the second.
    expect(first.observations.map((o) => o.line)).toEqual([
      "The dinosaur hat, 4 times this week.",
    ]);
    expect(db.writes).toHaveLength(1);
    expect(second.observations).toEqual(first.observations);
    expect(third.shownIds).toEqual(first.shownIds);
  });

  it("holds the sentence still when the archive changes underneath it", async () => {
    // Two more photographs on Wednesday should not silently rewrite Sunday's
    // "4 times this week" into "6".
    const memories = hatArchive();
    const db = fakeDb([], memories);
    const sunday = await weeklyNoteFor(db, "s1", { write: db, today: TODAY });
    memories.push(
      { ...memories[0], id: "extra-1", memory_date: ago(0) },
      { ...memories[0], id: "extra-2", memory_date: ago(0) }
    );
    const wednesday = await weeklyNoteFor(db, "s1", { write: db, today: TODAY });
    expect(wednesday.observations[0].line).toBe(sunday.observations[0].line);
  });

  it("does not start the clock for someone who cannot answer it", async () => {
    // A grandparent reading the archive sees the note; they do not get to
    // decide that this week has been used up.
    const db = fakeDb([], hatArchive());
    const seen = await weeklyNoteFor(db, "s1", { write: null, today: TODAY });
    expect(db.writes).toHaveLength(0);
    expect(seen.observations).toHaveLength(1);
    expect(seen.shownIds).toEqual([]);
  });
});

describe("what gets stored", () => {
  it("records a week where there was nothing, so the quiet weeks are cheap", () => {
    const rows = rowsFor("s1", { observations: [], gap: null, worthShowing: false });
    expect(rows).toHaveLength(1);
    expect(rows[0].shape).toBe("none");
  });

  it("keeps the question beside the lines rather than recomputing it", () => {
    const rows = rowsFor("s1", note({
      gap: { entityId: "person:Grandma", label: "Grandma", appearances: 12, question: "What do they usually do?" },
    }));
    expect(rows.map((r) => r.shape)).toEqual(["faded", "gap"]);
  });

  it("carries the memories every line was computed from", () => {
    // The provenance rule, applied to storage: a family asking "why did you
    // tell me that" gets an answer that is not a reconstruction.
    expect(rowsFor("s1", note())[0].memory_ids).toEqual(["m1", "m2"]);
  });
});

describe("reading a note back", () => {
  const stored = [
    { id: "a", entity_id: "thing:bun bun", line: "Bun Bun hasn't appeared since April.", shape: "faded", memory_ids: ["m1"], verdict: "shown" },
    { id: "b", entity_id: "thing:hat", line: "The dinosaur hat, 4 times this week.", shape: "surging", memory_ids: ["m2"], verdict: "shown" },
    { id: "c", entity_id: "person:Grandma", line: "Grandma is in a lot of these.", shape: "gap", memory_ids: [], verdict: "shown" },
  ];

  it("drops a line the moment the family says it was wrong", () => {
    const out = readStanding(stored.map((r) => (r.id === "a" ? { ...r, verdict: "ignored" } : r)));
    expect(out.observations.map((o) => o.line)).toEqual(["The dinosaur hat, 4 times this week."]);
    expect(out.shownIds).toEqual(["b"]);
  });

  it("shows the question as a question, not as a fourth observation", () => {
    const out = readStanding(stored);
    expect(out.observations).toHaveLength(2);
    expect(out.question).toBe("Grandma is in a lot of these.");
  });

  it("says nothing at all for a week that was recorded as empty", () => {
    const out = readStanding([
      { id: "z", entity_id: "none:2026-08-06", line: "", shape: "none", memory_ids: [], verdict: "shown" },
    ]);
    expect(out.worthShowing).toBe(false);
    expect(out.observations).toEqual([]);
    expect(out.question).toBeNull();
  });

  it("keeps ids lined up with the lines they answer", () => {
    // Off-by-one here means Keep on one observation records a verdict about
    // a different one, silently and forever.
    const out = readStanding(stored);
    expect(out.shownIds).toEqual(["a", "b"]);
  });

  it("stands for a week", () => {
    expect(NOTE_LIVES_DAYS).toBe(7);
  });
});
