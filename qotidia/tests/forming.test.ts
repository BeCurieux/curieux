// The book as it stands today.
//
// The failure this is really guarding against: a screen that says "one more
// and it's a chapter", somebody adds one more, and no chapter appears. That
// is worse than showing nothing, because it is the product making a promise
// about the one thing the family is paying for. So the tests below mostly
// check the projection against the real generator rather than against my
// idea of what the real generator does.

import { describe, expect, it } from "vitest";
import { A_BOOK_HAS_A_SHAPE, BECOMES_A_CHAPTER, bookSoFar, type SoFarInput } from "@/lib/book/forming";
import { proposeStructure } from "@/lib/book/structure";
import type { Memory, MemoryCluster } from "@/lib/types";

const memory = (id: string, over: Partial<Memory> = {}): Memory =>
  ({
    id,
    subject_id: "s1",
    type: "photo",
    memory_date: "2026-03-04",
    raw_text: null,
    transcript: null,
    people: [],
    ...over,
  }) as Memory;

const cluster = (title: string, ids: string[], status = "confirmed"): MemoryCluster =>
  ({
    subject_id: "s1",
    title,
    summary: null,
    start_date: null,
    end_date: null,
    confidence: 0.8,
    status,
    memory_ids: ids,
  }) as MemoryCluster;

const input = (over: Partial<SoFarInput> = {}): SoFarInput => ({
  subject: { display_name: "Florence", subject_type: "child" },
  yearNumber: 2,
  memories: Array.from({ length: 20 }, (_, i) => memory(`m${i}`)),
  clusters: [],
  littleThings: [],
  quotes: [],
  ...over,
});

describe("the contents page, forming", () => {
  it("says plainly that the book has no shape yet rather than showing a stub", () => {
    const out = bookSoFar(input({ memories: [memory("m1"), memory("m2")] }));
    expect(out.tooEarly).toBe(true);
    expect(A_BOOK_HAS_A_SHAPE).toBe(15);
  });

  it("leaves the bookends off the contents page", () => {
    // "Chapter one: the opening" is a contents page nobody reads. Both exist
    // in the real structure; neither is news.
    const out = bookSoFar(input({ clusters: [cluster("The yellow boots", ["m1", "m2", "m3"])] }));
    expect(out.chapters.map((c) => c.sectionType)).not.toContain("opening");
    expect(out.chapters.map((c) => c.sectionType)).not.toContain("closing");
  });

  it("shows a formed chapter with what is actually in it", () => {
    const out = bookSoFar(input({ clusters: [cluster("The yellow boots", ["m1", "m2", "m3"])] }));
    const boots = out.chapters.find((c) => c.title === "The yellow boots");
    expect(boots?.count).toBe(3);
  });
});

describe("what is nearly a chapter", () => {
  it("counts down to the real threshold, not an invented one", () => {
    const out = bookSoFar(input({ clusters: [cluster("Swimming", ["m1", "m2"])] }));
    const swimming = out.forming.find((f) => f.title === "Swimming");
    expect(swimming?.needs).toBe(1);
    expect(swimming?.note).toBe("One more and it's a chapter.");
  });

  it("keeps its promise: one more really does produce the chapter", () => {
    // The test that matters. The projection says one more; the real
    // generator is then asked, and has to agree. A screen that promises a
    // chapter at three while the generator wants four lies to somebody for a
    // month about the thing they are paying for.
    const nearly = input({ clusters: [cluster("Swimming", ["m1", "m2"])] });
    expect(bookSoFar(nearly).forming.find((f) => f.title === "Swimming")?.needs).toBe(1);

    const after = input({ clusters: [cluster("Swimming", ["m1", "m2", "m3"])] });
    const real = proposeStructure(after);
    expect(real.sections.map((s) => s.title)).toContain("Swimming");
    expect(bookSoFar(after).chapters.map((c) => c.title)).toContain("Swimming");
    expect(bookSoFar(after).forming.map((f) => f.title)).not.toContain("Swimming");
  });

  it("offers a suggested cluster as something to confirm, not something to wait for", () => {
    // Our guess at a thread. The family can turn it into a chapter today,
    // which is more useful than hiding it until somebody happens to visit
    // the clusters screen.
    const out = bookSoFar(
      input({ suggestedClusters: [cluster("Grandpa Thursdays", ["a", "b", "c", "d"], "suggested")] })
    );
    const grandpa = out.forming.find((f) => f.title === "Grandpa Thursdays");
    expect(grandpa?.note).toBe("We think this is a thread. Say yes and it's a chapter.");
  });

  it("counts quotes towards their own chapter", () => {
    const quotes = [memory("q1", { type: "quote" }), memory("q2", { type: "quote" })];
    const out = bookSoFar(input({ quotes }));
    expect(out.forming.find((f) => f.title === "Things you said")?.note).toBe(
      "One more quote and it's a chapter."
    );
    expect(BECOMES_A_CHAPTER.quotes).toBe(3);
  });

  it("says nothing about a chapter nobody has started", () => {
    // Zero quotes is not "three more quotes and it's a chapter" — it is a
    // chapter this family may simply not be having, and listing every
    // unstarted one turns a contents page into a checklist.
    const out = bookSoFar(input({ quotes: [] }));
    expect(out.forming.map((f) => f.title)).not.toContain("Things you said");
  });

  it("does not list something that is already a chapter", () => {
    const out = bookSoFar(
      input({
        quotes: [memory("q1", { type: "quote" }), memory("q2", { type: "quote" }), memory("q3", { type: "quote" })],
      })
    );
    expect(out.chapters.map((c) => c.title)).toContain("Things you said");
    expect(out.forming.map((f) => f.title)).not.toContain("Things you said");
  });

  it("puts the one that can be finished this afternoon first", () => {
    const out = bookSoFar(
      input({
        clusters: [cluster("Swimming", ["m1", "m2"]), cluster("The beach", ["m3"])],
      })
    );
    expect(out.forming.map((f) => f.title)).toEqual(["Swimming", "The beach"]);
  });
});

describe("the quiet months", () => {
  const spanning = (over: Partial<SoFarInput> = {}) =>
    input({
      periodStart: "2026-01-01",
      periodEnd: "2026-12-31",
      today: "2026-08-06",
      memories: [memory("m1", { memory_date: "2026-01-14" }), memory("m2", { memory_date: "2026-04-02" })],
      ...over,
    });

  it("names a month with nothing in it", () => {
    const out = bookSoFar(spanning());
    expect(out.quiet.map((q) => q.label)).toContain("February 2026");
    expect(out.quiet.map((q) => q.label)).toContain("March 2026");
  });

  it("leaves out a month that has something", () => {
    const out = bookSoFar(spanning());
    expect(out.quiet.map((q) => q.label)).not.toContain("January 2026");
    expect(out.quiet.map((q) => q.label)).not.toContain("April 2026");
  });

  it("does not call the month you are living in quiet", () => {
    // Telling somebody they have been quiet in August, on the 6th of August,
    // is the product not paying attention.
    const out = bookSoFar(spanning());
    expect(out.quiet.map((q) => q.label)).not.toContain("August 2026");
  });

  it("says nothing about months that have not happened", () => {
    const out = bookSoFar(spanning());
    expect(out.quiet.map((q) => q.label)).not.toContain("November 2026");
  });

  it("stays silent when the period is unknown", () => {
    expect(bookSoFar(input()).quiet).toEqual([]);
  });
});

describe("other kinds of book", () => {
  it("works for a family year, not just a child's", () => {
    // The engine is one engine; a family annual is a config entry, not a
    // fork. If this screen only understood children it would have to be
    // rebuilt the day the second book type ships.
    const out = bookSoFar(
      input({
        subject: { display_name: "The Wilsons", subject_type: "family" },
        yearNumber: null,
        calendarYear: 2028,
        clusters: [cluster("Cornwall", ["m1", "m2", "m3"])],
      })
    );
    expect(out.chapters.map((c) => c.title)).toContain("Cornwall");
    expect(out.title).toContain("2028");
  });
});
