// Turning an archive into entities.
//
// The double-counting case is the one that matters. A photograph tagged
// "bun bun" and also inside a cluster called "Bun Bun" is one appearance of
// one rabbit — count it twice and every observation about it is inflated,
// which is exactly the failure that makes a product feel like it is
// guessing.

import { describe, expect, it } from "vitest";
import { MIN_MENTIONS, buildEntities, type RawMention } from "@/lib/graph/extract";

const m = (over: Partial<RawMention> & { memoryId: string }): RawMention => ({
  date: "2026-08-01",
  kind: "thing",
  key: "bun bun",
  label: "Bun Bun",
  ...over,
});

describe("building entities", () => {
  it("counts one memory once, however many ways it mentions the same thing", () => {
    const rows = [
      m({ memoryId: "a", key: "bun bun" }),
      m({ memoryId: "a", key: "Bun Bun" }),   // the cluster, same memory
      m({ memoryId: "b" }),
      m({ memoryId: "c" }),
    ];
    const [bunbun] = buildEntities(rows);
    expect(bunbun.mentions).toHaveLength(3);
  });

  it("treats different spellings as one thing", () => {
    const rows = ["a", "b", "c"].map((id, i) =>
      m({ memoryId: id, key: i === 0 ? "BUN BUN" : " bun bun " })
    );
    expect(buildEntities(rows)).toHaveLength(1);
  });

  it("keeps the family's own words for display", () => {
    const rows = ["a", "b", "c"].map((id) => m({ memoryId: id, key: "yellow_boots", label: "yellow boots" }));
    expect(buildEntities(rows)[0].label).toBe("yellow boots");
  });

  it("ignores a coincidence", () => {
    // Two mentions of a word is two mentions of a word. The third makes it
    // a thing about this family.
    expect(buildEntities([m({ memoryId: "a" }), m({ memoryId: "b" })])).toEqual([]);
    expect(MIN_MENTIONS).toBe(3);
  });

  it("drops undated mentions rather than guessing when they happened", () => {
    const rows = [
      m({ memoryId: "a", date: null }),
      m({ memoryId: "b" }),
      m({ memoryId: "c" }),
      m({ memoryId: "d" }),
    ];
    expect(buildEntities(rows)[0].mentions).toHaveLength(3);
  });

  it("does not merge a person and a thing that share a name", () => {
    // A dog called Bun Bun and a rabbit called Bun Bun are two entities.
    const rows = [
      ...["a", "b", "c"].map((id) => m({ memoryId: id, kind: "person" })),
      ...["d", "e", "f"].map((id) => m({ memoryId: id, kind: "thing" })),
    ];
    expect(buildEntities(rows)).toHaveLength(2);
  });

  it("skips an empty key instead of creating a nameless entity", () => {
    const rows = ["a", "b", "c"].map((id) => m({ memoryId: id, key: "   " }));
    expect(buildEntities(rows)).toEqual([]);
  });

  it("says the rabbit once when a cluster and a tag cover the same memories", () => {
    // The real shape of this in the archive: a confirmed cluster is built
    // over a tag, so both exist and both describe the same five photographs.
    // Two lines about one rabbit in one weekly note is the thing that makes
    // a product look like it is pattern-matching rather than noticing.
    const ids = ["a", "b", "c", "d", "e"];
    const rows = [
      ...ids.map((id) => m({ memoryId: id, kind: "thing", key: "bun_bun", label: "bun bun" })),
      ...ids.map((id) => m({ memoryId: id, kind: "ritual", key: "Bun Bun", label: "Bun Bun" })),
    ];
    const entities = buildEntities(rows);
    expect(entities).toHaveLength(1);
    // And it keeps the name the family typed as a name, not as a filing label.
    expect(entities[0].label).toBe("Bun Bun");
  });

  it("keeps a memory the cluster missed when it merges", () => {
    const rows = [
      ...["a", "b", "c", "d"].map((id) => m({ memoryId: id, kind: "thing", key: "bun_bun", label: "bun bun" })),
      ...["a", "b", "c"].map((id) => m({ memoryId: id, kind: "ritual", key: "Bun Bun", label: "Bun Bun" })),
    ];
    const [bunbun] = buildEntities(rows);
    expect(bunbun.label).toBe("Bun Bun");
    expect(bunbun.mentions).toHaveLength(4);
  });

  it("leaves two threads alone when they barely overlap", () => {
    // Grandma is in one of the swimming photographs. That does not make
    // Grandma and swimming the same thing.
    const rows = [
      ...["a", "b", "c", "d", "e"].map((id) => m({ memoryId: id, kind: "thing", key: "swimming" })),
      ...["a", "x", "y"].map((id) => m({ memoryId: id, kind: "person", key: "Grandma" })),
    ];
    expect(buildEntities(rows)).toHaveLength(2);
  });

  it("puts the biggest threads first", () => {
    const rows = [
      ...["a", "b", "c"].map((id) => m({ memoryId: id, key: "boots" })),
      ...["d", "e", "f", "g", "h"].map((id) => m({ memoryId: id, key: "bun bun" })),
    ];
    expect(buildEntities(rows)[0].label).toBe("Bun Bun");
  });
});
