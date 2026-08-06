// One archive, many books.
//
// A memory belongs to a family, and a book is a question asked of the
// archive. Two rules decide what a book may take, and getting either wrong
// is invisible — a photograph in the wrong book still looks like a
// photograph, and a missing one looks like nothing at all.
//
//   A household's story takes the year, all of it.
//   A person's story takes only what they were tagged in.
//
// The static checks at the bottom exist because the compiler cannot help
// here: `memories.subject_id` is gone, and every query that still filters on
// it would typecheck perfectly and return nothing at run time.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { loadStoryMemories, memoryIdsForStory } from "@/lib/memories/scope";

const src = join(__dirname, "..", "src");

/** Just enough Supabase to answer the scoping questions. */
function fakeDb(rows: {
  memories: any[];
  links: { memory_id: string; subject_id: string }[];
}) {
  const build = (table: string) => {
    let data: any[] = table === "memories" ? [...rows.memories] : [...rows.links];
    const q: any = {
      select: () => q,
      eq: (col: string, val: any) => {
        data = data.filter((r) => r[col] === val);
        return q;
      },
      in: (col: string, vals: any[]) => {
        data = data.filter((r) => vals.includes(r[col]));
        return q;
      },
      not: () => q,
      order: () => q,
      limit: () => q,
      maybeSingle: () => Promise.resolve({ data: data[0] ?? null, error: null }),
      then: (res: any) => Promise.resolve({ data, error: null }).then(res),
    };
    return q;
  };
  return { from: build } as any;
}

const FLORENCE = { id: "flo", family_id: "f1", subject_type: "child" as const };
const HOUSEHOLD = { id: "house", family_id: "f1", subject_type: "family" as const };

const archive = {
  memories: [
    { id: "cornwall", family_id: "f1", memory_date: "2026-07-04" },
    { id: "florence-only", family_id: "f1", memory_date: "2026-03-01" },
    { id: "nobody-tagged", family_id: "f1", memory_date: "2026-05-05" },
    { id: "other-family", family_id: "f2", memory_date: "2026-05-05" },
  ],
  links: [
    { memory_id: "cornwall", subject_id: "flo" },
    { memory_id: "cornwall", subject_id: "theo" },
    { memory_id: "florence-only", subject_id: "flo" },
  ],
};

describe("what a story may take", () => {
  it("gives a household the whole year, including what nobody was tagged in", () => {
    // A family annual is not the sum of its children's books. It is the year
    // that happened, including the Sunday nobody was tagged in.
    return loadStoryMemories(fakeDb(archive), HOUSEHOLD).then((out) => {
      expect(out.map((m) => m.id).sort()).toEqual([
        "cornwall",
        "florence-only",
        "nobody-tagged",
      ]);
    });
  });

  it("gives a person only what they were tagged in", async () => {
    const out = await loadStoryMemories(fakeDb(archive), FLORENCE);
    expect(out.map((m) => m.id).sort()).toEqual(["cornwall", "florence-only"]);
  });

  it("leaves an untagged memory out of every person's book", async () => {
    // The rule and its corollary. Inferring who is in a photograph is the one
    // capability this product has decided not to have, so the alternative to
    // leaving it out is guessing.
    const out = await loadStoryMemories(fakeDb(archive), FLORENCE);
    expect(out.map((m) => m.id)).not.toContain("nobody-tagged");
  });

  it("lets one morning serve two children's books", async () => {
    const theo = { id: "theo", family_id: "f1", subject_type: "child" as const };
    const hers = await loadStoryMemories(fakeDb(archive), FLORENCE);
    const his = await loadStoryMemories(fakeDb(archive), theo);
    expect(hers.map((m) => m.id)).toContain("cornwall");
    expect(his.map((m) => m.id)).toContain("cornwall");
  });

  it("never reaches another family's archive", async () => {
    // The worst failure available in this product. The family filter is
    // applied even for a household story, where nothing else would have
    // constrained it.
    const out = await loadStoryMemories(fakeDb(archive), HOUSEHOLD);
    expect(out.map((m) => m.id)).not.toContain("other-family");
  });

  it("asks for no link list at all when the story is the household", async () => {
    // Null rather than every id in the archive: a family with six thousand
    // memories should not have six thousand uuids put into a URL to say
    // "all of them".
    expect(await memoryIdsForStory(fakeDb(archive), HOUSEHOLD)).toBeNull();
  });

  it("returns nothing for a person nobody has been tagged in yet", async () => {
    const stranger = { id: "nobody", family_id: "f1", subject_type: "child" as const };
    expect(await loadStoryMemories(fakeDb(archive), stranger)).toEqual([]);
  });
});

describe("no query still believes a memory belongs to a subject", () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.tsx?$/.test(entry.name)) files.push(path);
    }
  };
  walk(src);

  /**
   * Each `from("memories")` chain, ending where the statement does.
   *
   * Cut at the semicolon rather than at a fixed window, which is what the
   * first version did — and a window long enough to catch a real offender is
   * long enough to run past the end of the query into the comment below it,
   * so the check reported two files that were already correct.
   */
  const memoryChains = (code: string): string[] => {
    const out: string[] = [];
    const marker = /from\(["']memories["']\)/g;
    let m: RegExpExecArray | null;
    while ((m = marker.exec(code))) {
      const rest = code.slice(m.index, m.index + 1200);
      const end = rest.indexOf(";");
      out.push(end === -1 ? rest : rest.slice(0, end));
    }
    return out;
  };

  it("filters no memory query on subject_id", () => {
    // The column is gone. A query that still names it typechecks perfectly
    // and returns nothing, which on a dashboard reads as an empty archive
    // rather than as a bug.
    const offenders: string[] = [];
    for (const file of files) {
      for (const chain of memoryChains(readFileSync(file, "utf8"))) {
        if (/["']subject_id["']/.test(chain)) offenders.push(file.replace(src, "src"));
      }
    }
    expect([...new Set(offenders)]).toEqual([]);
  });

  it("writes no memory without an archive to put it in", () => {
    // family_id is not null in the database, so an insert that forgets it
    // fails loudly — but it fails at run time, on somebody's upload. Every
    // capture path goes through keepMemory(), which is the only place that
    // knows to set it.
    const offenders: string[] = [];
    for (const file of files) {
      if (file.endsWith(join("memories", "scope.ts"))) continue;
      const code = readFileSync(file, "utf8");
      for (const chain of memoryChains(code)) {
        if (/\.insert\(/.test(chain)) offenders.push(file.replace(src, "src"));
      }
    }
    expect([...new Set(offenders)]).toEqual([]);
  });
});
