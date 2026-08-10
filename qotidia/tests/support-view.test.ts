// Looking at a family's archive, with their permission.
//
// One test in this file matters more than the rest: the support view must
// read through the staff member's own client, never adminClient(). The
// service credential bypasses row-level security entirely, so a support view
// built on it would ignore the grant, its expiry, its revocation, the
// private-memory exclusion and the read-only rule — and would look exactly
// the same on screen. Everything 0026 added would become decoration, which
// is worse than never having built it, because /help now describes it.
//
// That guard is doing more work than it looks. adminClient() is the ordinary
// way to read across families everywhere else in this codebase, so the wrong
// thing here is also the habitual thing.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { codeOnly as bare } from "./helpers/source";
import { QUIET_MINUTES, hoursLeft, noteSupportLook, openGrants, shapeOf } from "@/lib/family/support-view";
import { SUPPORT_ACCESS_HOURS } from "@/lib/family/support";
import { ACTIVITY_PHRASE, ACTOR_IS_US, SUPPORT_ACTOR } from "@/lib/privacy/activity";

const src = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const loader = src("../src/lib/family/support-view.ts");
const queue = src("../src/app/admin/support/page.tsx");
const detail = src("../src/app/admin/support/[familyId]/page.tsx");
const migration = src("../supabase/migrations/0026_support_access.sql");

/** A client that records what was asked and answers with fixtures. */
function fakeDb(tables: Record<string, any[]>) {
  const seen: any[] = [];
  const make = (table: string) => {
    const q: any = { _filters: [] as any[] };
    for (const m of ["select", "is", "gt", "eq", "in", "order", "limit"]) {
      q[m] = (...args: any[]) => {
        q._filters.push([m, ...args]);
        return q;
      };
    }
    q.then = (res: any) => {
      seen.push([table, q._filters]);
      return Promise.resolve({ data: tables[table] ?? [], count: (tables[table] ?? []).length }).then(res);
    };
    return q;
  };
  return { seen, db: { from: (t: string) => make(t) } as any };
}

describe("the read goes through the staff member's own client", () => {
  it("never touches the admin client to read family content", () => {
    // The single most important line in this file.
    const code = bare(loader);
    expect(code).not.toContain("adminClient");
    expect(code).not.toContain("service_role");
  });

  it("takes the client from its caller rather than making one", () => {
    expect(loader).toMatch(/db:\s*SupabaseClient/);
  });

  it("and the pages hand it the user client", () => {
    for (const [name, page] of [["queue", queue], ["detail", detail]] as const) {
      expect(page, name).toMatch(/userClient\(\)/);
      // openGrants/grantFor/shapeOf must all be called with db, not admin.
      expect(bare(page), name).not.toMatch(/(openGrants|grantFor|shapeOf)\(\s*admin/);
    }
  });

  it("uses the admin client only to write the log", () => {
    // The one deliberate exception, and it is a write, not a read.
    const note = loader.slice(loader.indexOf("export async function noteSupportLook"));
    expect(note).toMatch(/admin:\s*SupabaseClient/);
    expect(detail).toMatch(/noteSupportLook\(admin/);
  });
});

describe("the family is told", () => {
  it("writes the visit before anything is rendered", () => {
    // A record that depends on the page finishing is not a record.
    const shown = detail.indexOf("shapeOf(db");
    const logged = detail.indexOf("noteSupportLook(");
    expect(logged).toBeGreaterThan(-1);
    expect(logged).toBeLessThan(shown);
  });

  it("records a look, with the family's own words for why", async () => {
    const writes: any[] = [];
    const admin = {
      from: (table: string) => ({
        select: () => ({ eq: () => ({ eq: () => ({ gt: () => ({ limit: async () => ({ data: [] }) }) }) }) }),
        insert: (row: any) => {
          writes.push([table, row]);
          return Promise.resolve({});
        },
      }),
    } as any;

    const wrote = await noteSupportLook(admin, {
      familyId: "fam", staffId: "staff", staffLabel: "sam", reason: "the book is stuck",
    });
    expect(wrote).toBe(true);
    expect(writes[0][0]).toBe("activity_log");
    expect(writes[0][1].kind).toBe("support_access_used");
    expect(writes[0][1].detail).toBe("the book is stuck");
  });

  it("treats a session of looking as one look, not one per refresh", async () => {
    // A log filled with noise from one support session is a log a family
    // learns to skim, which defeats the only thing it is for.
    const admin = {
      from: () => ({
        select: () => ({ eq: () => ({ eq: () => ({ gt: () => ({ limit: async () => ({ data: [{ id: "x" }] }) }) }) }) }),
        insert: () => {
          throw new Error("should not have written a second entry");
        },
      }),
    } as any;
    expect(await noteSupportLook(admin, {
      familyId: "fam", staffId: "s", staffLabel: "sam", reason: "again",
    })).toBe(false);
  });

  it("signs the entry as us, never as a staff member", () => {
    // The log rendered "sam — our support team looked, with your permission":
    // bad grammar, and a staff username put in front of a customer to say
    // it. The family needs to know support looked, not which of us. actor_id
    // still records that for an internal audit.
    expect(SUPPORT_ACTOR).toBe("Support");
    expect(detail).toMatch(/staffLabel: SUPPORT_ACTOR/);
    expect(bare(detail)).not.toMatch(/email\?\.split/);
    expect(ACTOR_IS_US.has("support_access_used")).toBe(true);
    // And the phrase stands as a sentence now that nothing precedes it.
    expect(ACTIVITY_PHRASE.support_access_used).toMatch(/^Our support team looked/);
  });

  it("leaves every other entry attributed to the person who did it", () => {
    // The rule is one kind wide. "Gran added something" must not become
    // "added something".
    for (const kind of ["added_memory", "invited_member", "ordered_book"] as const) {
      expect(ACTOR_IS_US.has(kind), kind).toBe(false);
    }
    const page = src("../src/app/settings/privacy/page.tsx");
    expect(page).toMatch(/!ACTOR_IS_US\.has/);
    expect(page).toMatch(/a\.actor_id === user\.id \? "You" : a\.actor_label/);
  });

  it("keeps that window short, because under-logging is the worse error", () => {
    expect(QUIET_MINUTES).toBeGreaterThan(0);
    expect(QUIET_MINUTES).toBeLessThanOrEqual(30);
  });
});

describe("what the queue shows", () => {
  it("asks only for grants that are open", async () => {
    const { db, seen } = fakeDb({ support_grants: [] });
    await openGrants(db);
    const [table, filters] = seen[0];
    expect(table).toBe("support_grants");
    expect(filters).toContainEqual(["is", "revoked_at", null]);
    expect(filters.some((f: any[]) => f[0] === "gt" && f[1] === "expires_at")).toBe(true);
  });

  it("does not ask for a family name when there is nothing to ask about", async () => {
    const { db, seen } = fakeDb({ support_grants: [] });
    expect(await openGrants(db)).toEqual([]);
    expect(seen).toHaveLength(1);
  });

  it("survives a family whose name the gate withheld", async () => {
    // The families policy is gated on support_may_read. A missing name is
    // the gate working, not an error, and the id is enough to proceed.
    const { db } = fakeDb({
      support_grants: [{ id: "g1", family_id: "f1", reason: "stuck", expires_at: "x", created_at: "y" }],
      families: [],
    });
    const [only] = await openGrants(db);
    expect(only.familyName).toBeNull();
    expect(only.familyId).toBe("f1");
  });

  it("names the family on every query, including the books", async () => {
    // The books policy would keep another family's out, but a staff member
    // holding two open grants at once would have seen both families' books
    // in one list, silently, with nothing on the page to say so.
    const { db, seen } = fakeDb({
      subjects: [{ id: "s1", display_name: "Florence", date_of_birth: null }],
      memories: [], media_assets: [], books: [],
    });
    await shapeOf(db, "fam-1");
    const books = seen.find(([t]: any[]) => t === "books");
    expect(books, "books was not queried").toBeTruthy();
    expect(books[1]).toContainEqual(["in", "subject_id", ["s1"]]);
    for (const [table, filters] of seen) {
      if (table === "books" || table === "families") continue;
      expect(filters, table).toContainEqual(["eq", "family_id", "fam-1"]);
    }
  });

  it("asks for no books at all when there is nobody in the family", async () => {
    const { db, seen } = fakeDb({ subjects: [], memories: [], media_assets: [] });
    const shape = await shapeOf(db, "fam-1");
    expect(shape.books).toEqual([]);
    expect(seen.some(([t]: any[]) => t === "books")).toBe(false);
  });

  it("counts down in whole hours and never below zero", () => {
    const now = "2027-06-01T12:00:00.000Z";
    expect(hoursLeft("2027-06-01T20:30:00.000Z", now)).toBe(8);
    expect(hoursLeft("2027-05-30T00:00:00.000Z", now)).toBe(0);
  });
});

describe("what the page may not do", () => {
  it("offers no control that changes anything", () => {
    // The database refuses writes during a grant. The page should not imply
    // otherwise by showing a button that will fail.
    for (const [name, page] of [["queue", queue], ["detail", detail]] as const) {
      expect(bare(page), name).not.toMatch(/<form|<button|<textarea|<input/);
    }
  });

  it("shows no photographs, though the policies would allow it", () => {
    // A capability nobody builds is a capability nobody misuses. The grant
    // was given to answer "why is her book stuck", not to browse.
    expect(bare(detail)).not.toMatch(/<img|resolvePhotoUrls|storage_path|readUrl/);
  });

  it("never asks the storage layer for anything", () => {
    // This file is on the allowlist in tests/media.test.ts for the serving
    // gate, on the grounds that it counts rows and never produces a path.
    // That exemption is only safe while it stays true, so it is checked
    // here rather than trusted there.
    const code = bare(loader);
    expect(code).not.toMatch(/storage_path|thumbnail_path|readUrl|getObjectStore/);
    const assets = code.slice(code.indexOf('from("media_assets")'));
    expect(assets.slice(0, 200)).toMatch(/count: "exact", head: true/);
    expect(assets.slice(0, 200)).toMatch(/scan_verdict", "pending"/);
  });

  it("shows counts rather than contents", () => {
    expect(bare(detail)).not.toMatch(/raw_text|transcript|memory\.text/);
    expect(detail).toMatch(/Counts only/);
  });

  it("says plainly that private is excluded and that the visit is logged", () => {
    expect(detail).toMatch(/private memories are not shown/i);
    expect(detail).toMatch(/in their activity log/i);
    // And attributes both to the database rather than to this page's manners.
    expect(detail).toMatch(/the database refuses both/i);
  });

  it("shows zeros rather than a 404 for an empty archive", () => {
    // "She says she uploaded two hundred photos and there are none" is the
    // most useful thing this page can say. An earlier draft raised a 404,
    // which reads as a wrong URL and hides the finding.
    expect(bare(detail)).not.toContain("notFound");
  });

  it("treats no grant as a normal answer, not an error", () => {
    // A family withdrawing permission is the mechanism working.
    expect(detail).toMatch(/Nothing is open for this family/);
    expect(detail).toMatch(/taken\s+it back/);
    expect(detail).toContain("SUPPORT_ACCESS_HOURS");
  });

  it("checks staff in the app as well as in the database", () => {
    for (const [name, page] of [["queue", queue], ["detail", detail]] as const) {
      expect(page, name).toMatch(/is_admin/);
      expect(page, name).toMatch(/redirect\("\/home"\)/);
    }
  });

  it("is kept out of any index", () => {
    expect(src("../src/app/robots.ts")).toContain('"/admin"');
  });
});

describe("the gate the page depends on", () => {
  // These live in the migration and are exercised for real by
  // scripts/verify-schema.sh. Asserted here too so that a change to the SQL
  // that removed them would fail the ordinary test run as well.
  it("requires staff and a live grant, both", () => {
    expect(migration).toMatch(/is_staff\(\) and support_access_active\(fid\)/);
  });

  it("grants select and nothing else", () => {
    const policies = migration.match(/create policy "[^"]*support[^"]*"[\s\S]*?;/g) ?? [];
    expect(policies.length).toBeGreaterThanOrEqual(5);
    for (const p of policies) expect(p, p.slice(0, 60)).toMatch(/for select/);
  });

  it("excludes private memories with no escape hatch", () => {
    // From the definition, not from the header comment that names it.
    const fn = migration.slice(
      migration.indexOf("create or replace function can_see_memory_as_support"));
    expect(fn).toMatch(/m\.visibility = 'family'/);
    expect(fn.slice(0, fn.indexOf("$$;"))).not.toMatch(/created_by = signed_in_user/);
  });

  it("expires without anybody remembering to end it", () => {
    expect(SUPPORT_ACCESS_HOURS).toBeLessThanOrEqual(48);
    expect(src("../supabase/migrations/0011_privacy.sql"))
      .toMatch(/expires_at < created_at \+ interval '7 days'/);
  });
});
