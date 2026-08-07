// Who is in it.
//
// A family taps a name. Behind the name are two tables and a distinction
// with real consequences — tagging Florence decides which book a photograph
// can appear in; tagging Grandpa decides what the book says about her people
// — and they should never have to learn either.
//
// So these test the routing, and one thing about the list itself: that its
// order is stable. A chip row that reorders between visits is a chip row
// people mis-tap, and a mis-tap here puts a photograph in the wrong child's
// book, where it still looks like a photograph.

import { describe, expect, it } from "vitest";
import { keyFor, parseKey, peopleInFamily, toggleWho, whoIsIn } from "@/lib/memories/who";

function fakeDb(tables: Record<string, any[]>) {
  const deleted: any[] = [];
  const inserted: any[] = [];

  const client: any = {
    deleted,
    inserted,
    from(table: string) {
      let rows = [...(tables[table] ?? [])];
      const q: any = {
        select: () => q,
        eq: (col: string, val: any) => {
          rows = rows.filter((r) => r[col] === val);
          return q;
        },
        in: (col: string, vals: any[]) => {
          rows = rows.filter((r) => vals.includes(r[col]));
          return q;
        },
        order: () => q,
        limit: () => q,
        maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
        delete: () => {
          const d: any = {
            eq: (col: string, val: any) => {
              rows = rows.filter((r) => r[col] === val);
              deleted.push({ table, rows });
              return d;
            },
            then: (res: any) => Promise.resolve({ error: null }).then(res),
          };
          return d;
        },
        insert: (row: any) => {
          inserted.push({ table, row });
          return Promise.resolve({ error: null });
        },
        then: (res: any) => Promise.resolve({ data: rows, error: null }).then(res),
      };
      return q;
    },
  };
  return client;
}

const family = {
  subjects: [
    { id: "flo", family_id: "f1", display_name: "Florence", subject_type: "child" },
    { id: "theo", family_id: "f1", display_name: "Theo", subject_type: "child" },
    { id: "house", family_id: "f1", display_name: "The Wilsons", subject_type: "family" },
  ],
  family_members: [
    { id: "m1", family_id: "f1", name: "Margaret", relationship: "Grandma" },
    { id: "m2", family_id: "f1", name: "Tom", relationship: "Grandpa" },
  ],
};

describe("everybody a memory could be about", () => {
  it("offers children and family members as one list", async () => {
    const people = await peopleInFamily(fakeDb(family), "f1");
    expect(people.map((p) => p.name)).toEqual(["Florence", "Theo", "Margaret", "Tom"]);
  });

  it("leaves the household out, because it is not a person", async () => {
    // The Wilsons are a book, not somebody who can be in a photograph — and
    // everything in the archive is already in that book.
    const people = await peopleInFamily(fakeDb(family), "f1");
    expect(people.map((p) => p.name)).not.toContain("The Wilsons");
  });

  it("says which of them have a book of their own", async () => {
    // The only place the distinction surfaces at all: tagging a child
    // decides which annual a photograph can reach.
    const people = await peopleInFamily(fakeDb(family), "f1");
    expect(people.find((p) => p.name === "Florence")?.hasBook).toBe(true);
    expect(people.find((p) => p.name === "Tom")?.hasBook).toBe(false);
  });

  it("puts children first, so the tap that changes a book is the nearest one", async () => {
    const people = await peopleInFamily(fakeDb(family), "f1");
    expect(people[0].hasBook).toBe(true);
    expect(people[people.length - 1].hasBook).toBe(false);
  });
});

describe("routing a tap to the right table", () => {
  it("keeps the two kinds apart in one list of chips", () => {
    expect(parseKey(keyFor("subject", "flo"))).toEqual({ kind: "subject", id: "flo" });
    expect(parseKey(keyFor("member", "m1"))).toEqual({ kind: "member", id: "m1" });
  });

  it("refuses a key it does not recognise rather than guessing a table", () => {
    expect(parseKey("person:flo")).toBeNull();
    expect(parseKey("flo")).toBeNull();
    expect(parseKey("subject:")).toBeNull();
  });

  it("sends a child to memory_subjects, which is what decides the book", async () => {
    const db = fakeDb({ memory_subjects: [], memory_people: [] });
    await toggleWho(db, "mem1", keyFor("subject", "flo"));
    expect(db.inserted).toEqual([
      { table: "memory_subjects", row: { memory_id: "mem1", subject_id: "flo" } },
    ]);
  });

  it("sends a grandparent to memory_people, which is what the chapter reads", async () => {
    const db = fakeDb({ memory_subjects: [], memory_people: [] });
    await toggleWho(db, "mem1", keyFor("member", "m2"));
    expect(db.inserted).toEqual([
      { table: "memory_people", row: { memory_id: "mem1", family_member_id: "m2" } },
    ]);
  });

  it("takes a name off again when it is already there", async () => {
    // A toggle, not an add. Tagging is dozens of small decisions and some of
    // them are wrong; undoing has to be the same single tap as doing.
    const db = fakeDb({
      memory_subjects: [{ memory_id: "mem1", subject_id: "flo" }],
      memory_people: [],
    });
    await toggleWho(db, "mem1", keyFor("subject", "flo"));
    expect(db.inserted).toEqual([]);
    expect(db.deleted.length).toBeGreaterThan(0);
  });

  it("does nothing at all with a malformed key", async () => {
    const db = fakeDb({ memory_subjects: [], memory_people: [] });
    await toggleWho(db, "mem1", "nonsense");
    expect(db.inserted).toEqual([]);
    expect(db.deleted).toEqual([]);
  });
});

describe("what is already tagged", () => {
  it("reads both tables into one answer per memory", async () => {
    const db = fakeDb({
      memory_subjects: [
        { memory_id: "cornwall", subject_id: "flo" },
        { memory_id: "cornwall", subject_id: "theo" },
      ],
      memory_people: [{ memory_id: "cornwall", family_member_id: "m2" }],
    });
    const out = await whoIsIn(db, ["cornwall"]);
    expect([...out.get("cornwall")!].sort()).toEqual([
      "member:m2",
      "subject:flo",
      "subject:theo",
    ]);
  });

  it("says nothing for a memory nobody is in", async () => {
    const db = fakeDb({ memory_subjects: [], memory_people: [] });
    expect((await whoIsIn(db, ["lonely"])).get("lonely")).toBeUndefined();
  });

  it("asks nothing when there is nothing to ask about", async () => {
    const db = fakeDb({});
    expect(await whoIsIn(db, [])).toEqual(new Map());
  });
});
