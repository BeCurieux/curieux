// The receipt under an observation.
//
// Everything this product says about a family is arithmetic over what the
// family kept, and until now nothing showed the arithmetic. The rule existed
// in the code; the receipt did not exist on the screen.
//
// Two things are being defended here. The first is that the panel is honest —
// it says how many memories an observation came from, and if it shows fewer
// than that it says so rather than quietly padding the grid. The second is
// the one that actually costs something if it goes wrong: the receipt reads
// through the caller's own client, so row-level security decides what comes
// back. A contributor who can see six of a subject's memories must not learn
// about the other forty by opening a disclosure.

import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MOST_SHOWN, evidenceFor, worthShowing } from "@/lib/graph/evidence";
import { setObjectStore } from "@/lib/storage/provider";

const source = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

// A client that answers the two queries the loader makes, and records them.
function fakeDb(rows: any[], assets: any[] = []) {
  const seen: any = { tables: [], filters: [] };
  const make = (table: string) => {
    const q: any = {
      select: () => q,
      in: (col: string, ids: string[]) => {
        seen.filters.push([table, "in", col, ids]);
        return q;
      },
      eq: (col: string, v: unknown) => {
        seen.filters.push([table, "eq", col, v]);
        return q;
      },
      order: () => q,
      then: (res: any) =>
        Promise.resolve({ data: table === "memories" ? rows : assets }).then(res),
    };
    return q;
  };
  return {
    seen,
    db: {
      from: (table: string) => {
        seen.tables.push(table);
        return make(table);
      },
    } as any,
  };
}

const memory = (id: string, patch: any = {}) => ({
  id,
  memory_date: "2027-04-02",
  raw_text: null,
  type: "photo",
  ...patch,
});

beforeEach(() => {
  setObjectStore({
    readUrl: async (_b: any, path: string) => `https://signed.example/${path}?sig=x`,
    writeTicket: async () => ({ url: "", fields: {} }) as any,
    put: async () => {},
    get: async () => new Uint8Array(),
    remove: async () => {},
  } as any);
});

describe("whether to offer it at all", () => {
  it("takes more than one memory to be evidence", () => {
    // A disclosure that opens onto a single photograph makes the claim look
    // weaker than it is.
    expect(worthShowing([])).toBe(false);
    expect(worthShowing(["a"])).toBe(false);
    expect(worthShowing(["a", "b"])).toBe(true);
  });

  it("shows fewer than it counts rather than padding the grid", () => {
    expect(MOST_SHOWN).toBeGreaterThan(4);
    expect(MOST_SHOWN).toBeLessThanOrEqual(16);
  });
});

describe("loading what an observation was counted from", () => {
  it("asks for nothing when there is nothing to ask about", async () => {
    const { db, seen } = fakeDb([]);
    expect(await evidenceFor(db, [])).toEqual([]);
    expect(seen.tables).toEqual([]);
  });

  it("does not ask twice for the same memory", async () => {
    // Observations count mentions, and one memory can carry a thing twice.
    const { db, seen } = fakeDb([memory("m1")]);
    await evidenceFor(db, ["m1", "m1", "m1"]);
    expect(seen.filters[0]).toEqual(["memories", "in", "id", ["m1"]]);
  });

  it("resolves a signed URL for the photographs", async () => {
    const { db } = fakeDb(
      [memory("m1"), memory("m2")],
      [
        { memory_id: "m1", storage_path: "f/1.jpg" },
        { memory_id: "m2", storage_path: "f/2.jpg" },
      ]
    );
    const out = await evidenceFor(db, ["m1", "m2"]);
    expect(out.map((e) => e.photoUrl)).toEqual([
      "https://signed.example/f/1.jpg?sig=x",
      "https://signed.example/f/2.jpg?sig=x",
    ]);
  });

  it("still checks the scan verdict before serving a file", async () => {
    // A receipt is not a reason to serve a file nothing has read.
    const { db, seen } = fakeDb([memory("m1")], []);
    await evidenceFor(db, ["m1"]);
    expect(seen.filters).toContainEqual(["media_assets", "eq", "scan_verdict", "clean"]);
  });

  it("carries the words for something written rather than photographed", async () => {
    // Otherwise the grid is a grey box saying "text", which is worse than
    // useless as evidence.
    const { db } = fakeDb([memory("m1", { type: "note", raw_text: "She wore them to bed." })]);
    const [only] = await evidenceFor(db, ["m1"]);
    expect(only.text).toBe("She wore them to bed.");
    expect(only.photoUrl).toBeNull();
  });

  it("does not go looking for files where there are no photographs", async () => {
    const { db, seen } = fakeDb([memory("m1", { type: "note", raw_text: "Something." })]);
    await evidenceFor(db, ["m1"]);
    expect(seen.tables).toEqual(["memories"]);
  });

  it("shows at most twelve however many it was counted from", async () => {
    const ids = Array.from({ length: 40 }, (_, i) => `m${i}`);
    const { db } = fakeDb(ids.map((id) => memory(id)));
    expect(await evidenceFor(db, ids)).toHaveLength(MOST_SHOWN);
  });

  it("survives a file that has gone missing rather than failing the page", async () => {
    setObjectStore({
      readUrl: async () => {
        throw new Error("gone");
      },
    } as any);
    const { db } = fakeDb([memory("m1")], [{ memory_id: "m1", storage_path: "f/1.jpg" }]);
    const [only] = await evidenceFor(db, ["m1"]);
    expect(only.photoUrl).toBeNull();
  });
});

describe("what the receipt may reach", () => {
  const loader = source("../src/lib/graph/evidence.ts");

  it("reads through the caller's own client, never the admin one", () => {
    // The weekly note is computed server-side over the whole archive. If the
    // receipt escalated, opening a disclosure would be a way to read past
    // the wall the rest of the product maintains all day.
    expect(loader).not.toContain("adminClient");
    expect(loader).not.toContain("service_role");
    expect(loader).toMatch(/db:\s*SupabaseClient/);
  });

  it("fetches only the ids it was handed", () => {
    // Not "everything for this subject", and not a date range around them.
    expect(loader).toContain('.in("id", ids)');
    expect(loader).not.toMatch(/\.eq\("subject_id"/);
  });
});

describe("what the panel says", () => {
  const panel = source("../src/app/why.tsx");

  it("is closed until somebody asks", () => {
    // The point of the product is that a parent does not have to check. The
    // option to check is what makes not checking reasonable.
    expect(panel).toContain("<details");
    expect(panel).not.toContain("open=");
  });

  it("says the real count, not the number of thumbnails", () => {
    expect(panel).toMatch(/countOf\(total,/);
    expect(panel).toMatch(/total > evidence\.length/);
  });

  it("needs no JavaScript and no navigation", () => {
    // An observation and its evidence belong on the same page in the same
    // breath; sending somebody somewhere to verify a sentence is how
    // verification becomes something nobody does.
    expect(panel).not.toContain("use client");
    expect(panel).not.toContain("useState");
    expect(panel).not.toMatch(/<Link/);
  });

  it("claims no more than counting", () => {
    // The panel is the one place a family looks closely at what we said we
    // did, so it is the worst possible place to overstate it.
    expect(panel).toMatch(/don&rsquo;t look at what&rsquo;s in the photographs/);
    expect(panel).not.toMatch(/\b(understands?|recognis|analys|detect)/i);
  });
});
