// Analytics we could publish.
//
// That is the standard, and it is not rhetorical: if this whole table
// appeared on the privacy page, nothing in it should embarrass us or
// identify anybody. Every test here is a way that standard gets lost.
//
// The one that matters most is the third-party check. Everything else in
// this codebase has been careful — photographs never leave for a model, the
// support view reads through a grant, a private note is private — and the way
// a product like this betrays itself is not a decision, it is an npm
// install. Promise 1 says we never sell a family's information or show them
// an advertisement; a script tag would break it in an afternoon and nobody
// would experience having chosen to.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  EVENTS, FUNNEL, KEEP_FOR_DAYS, NEVER_RECORDED, NORTH_STAR, WINDOW_DAYS, windowOf,
} from "@/lib/analytics/events";
import { note, pseudonym, tally } from "@/lib/analytics/record";

const root = new URL("../src/", import.meta.url).pathname;
const src = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const events = src("../src/lib/analytics/events.ts");
const writer = src("../src/lib/analytics/record.ts");
const migration = src("../supabase/migrations/0029_analytics.sql");
const bare = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*(\/\/|--|\*).*$/gm, "");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = `${dir}${name}`;
    if (statSync(path).isDirectory()) walk(`${path}/`, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(path);
  }
  return out;
}

describe("nothing leaves this database", () => {
  it("ships no third-party analytics anywhere in the source", () => {
    const offenders: string[] = [];
    for (const path of walk(root)) {
      const body = bare(readFileSync(path, "utf8"));
      if (/googletagmanager|google-analytics|gtag\(|segment\.(com|io)|analytics\.track|mixpanel|amplitude|posthog|plausible\.io|fathom|hotjar|fullstory/i.test(body)) {
        offenders.push(path.replace(root, "src/"));
      }
    }
    expect(offenders).toEqual([]);
  });

  it("has no such dependency either", () => {
    const pkg = JSON.parse(src("../package.json"));
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).join(" ");
    expect(deps).not.toMatch(/mixpanel|segment|amplitude|posthog|analytics|gtag|hotjar/i);
  });

  it("would notice if somebody added one", () => {
    // A guard nobody has watched fail is not a guard.
    const pretend = 'window.gtag("event", "purchase");';
    expect(/gtag\(/i.test(pretend)).toBe(true);
  });

  it("records from the server, never from a browser", () => {
    // A beacon buys nothing here — every event already happens inside a
    // server action — and costs an IP address we do not want.
    expect(writer).not.toMatch(/use client|navigator\.sendBeacon|fetch\(/);
    expect(events).not.toContain("use client");
  });
});

describe("what the table can hold", () => {
  it("has four columns and none of them is an identity", () => {
    const table = migration.slice(
      migration.indexOf("create table if not exists analytics_events"),
      migration.indexOf(");", migration.indexOf("create table if not exists analytics_events"))
    );
    for (const forbidden of ["user_id", "family_id", "memory_id", "subject_id",
                             "email", "ip", "user_agent", "referrer", "url", "path"]) {
      expect(table, forbidden).not.toMatch(new RegExp(`\\b${forbidden}\\b`));
    }
    expect(table).toMatch(/\bname\b/);
    expect(table).toMatch(/\bwho\b/);
    expect(table).toMatch(/\bcount\b/);
  });

  it("refuses at the database level anything that is not a hash", () => {
    // Not a convention. A constraint, so a user id cannot be written into
    // `who` by a code path nobody reviewed.
    expect(migration).toMatch(/who ~ '\^\[0-9a-f\]\{32\}\$'/);
  });

  it("bounds the one number, so precision cannot become an identifier", () => {
    expect(migration).toMatch(/count >= 0 and count <= 10000/);
    expect(writer).toMatch(/Math\.min\(Math\.max\(0, Math\.round\(event\.count\)\), MOST\)/);
  });

  it("offers no place at all to put a string", () => {
    // Every way this goes wrong begins with a place to put a string.
    expect(events).toMatch(/count\?: number/);
    const iface = events.slice(events.indexOf("export interface Event"), events.indexOf("}", events.indexOf("export interface Event")));
    expect(iface).not.toMatch(/string/);
  });

  it("is readable by nobody holding the publishable key", () => {
    // Row-level security on, zero policies — the same shape as the jobs
    // table, and the rls.sql check documents that pattern.
    expect(migration).toMatch(/alter table analytics_events enable row level security/);
    expect(migration).not.toMatch(/create policy .* on analytics_events/);
  });
});

describe("the pseudonym", () => {
  const salted = <T>(fn: () => T): T => {
    const before = process.env.ANALYTICS_SALT;
    process.env.ANALYTICS_SALT = "a-test-salt";
    try {
      return fn();
    } finally {
      if (before === undefined) delete process.env.ANALYTICS_SALT;
      else process.env.ANALYTICS_SALT = before;
    }
  };

  it("is stable within a window, so a funnel can be drawn", () => {
    salted(() => {
      const a = pseudonym("user-1", "2027-06-01T00:00:00.000Z");
      const b = pseudonym("user-1", "2027-06-02T00:00:00.000Z");
      expect(a).toBe(b);
      expect(a).toMatch(/^[0-9a-f]{32}$/);
    });
  });

  it("changes between windows, so nobody can be followed", () => {
    salted(() => {
      const now = "2027-06-01T00:00:00.000Z";
      const later = new Date(Date.parse(now) + (WINDOW_DAYS + 1) * 86_400_000).toISOString();
      expect(pseudonym("user-1", now)).not.toBe(pseudonym("user-1", later));
    });
  });

  it("tells two people apart", () => {
    salted(() => {
      expect(pseudonym("user-1", "2027-06-01T00:00:00.000Z"))
        .not.toBe(pseudonym("user-2", "2027-06-01T00:00:00.000Z"));
    });
  });

  it("contains no part of the user id", () => {
    salted(() => {
      const id = "cafebabe-0000-0000-0000-000000000001";
      expect(pseudonym(id, "2027-06-01T00:00:00.000Z")).not.toContain("cafebabe");
    });
  });

  it("is nothing at all without a salt", () => {
    // Development and tests record nothing, rather than recording something
    // that only looks anonymous.
    delete process.env.ANALYTICS_SALT;
    expect(pseudonym("user-1")).toBeNull();
  });

  it("covers the funnel it needs to and no more", () => {
    // Long enough for signing up, uploading, being told something and
    // sharing it. Short enough that nobody is followed from one book to the
    // next.
    expect(WINDOW_DAYS).toBeGreaterThanOrEqual(30);
    expect(WINDOW_DAYS).toBeLessThanOrEqual(90);
  });

  it("puts adjacent moments in the same window and distant ones apart", () => {
    expect(windowOf("2027-06-01T00:00:00.000Z")).toBe(windowOf("2027-06-01T23:00:00.000Z"));
    expect(windowOf("2027-06-01T00:00:00.000Z"))
      .toBeLessThan(windowOf("2028-06-01T00:00:00.000Z"));
  });
});

describe("writing an event", () => {
  it("writes nothing when there is no salt", async () => {
    delete process.env.ANALYTICS_SALT;
    let wrote = false;
    const db = { from: () => ({ insert: async () => { wrote = true; } }) } as any;
    await note(db, "user-1", { name: "signed_up" });
    expect(wrote).toBe(false);
  });

  it("never throws, whatever the database does", async () => {
    // An archive that refuses a parent's photographs because an analytics
    // insert timed out has its priorities exactly backwards.
    process.env.ANALYTICS_SALT = "a-test-salt";
    const db = { from: () => { throw new Error("database is on fire"); } } as any;
    await expect(note(db, "user-1", { name: "upload_finished", count: 3 })).resolves.toBeUndefined();
    delete process.env.ANALYTICS_SALT;
  });

  it("writes the name, the pseudonym and the count — and nothing else", async () => {
    process.env.ANALYTICS_SALT = "a-test-salt";
    let row: any = null;
    const db = { from: () => ({ insert: async (r: any) => { row = r; } }) } as any;
    await note(db, "user-1", { name: "upload_finished", count: 12 });
    expect(Object.keys(row).sort()).toEqual(["count", "name", "who"]);
    expect(row.who).not.toContain("user-1");
    delete process.env.ANALYTICS_SALT;
  });

  it("clamps a silly count rather than storing it", async () => {
    process.env.ANALYTICS_SALT = "a-test-salt";
    let row: any = null;
    const db = { from: () => ({ insert: async (r: any) => { row = r; } }) } as any;
    await note(db, "user-1", { name: "upload_finished", count: 9_999_999 });
    expect(row.count).toBe(10_000);
    delete process.env.ANALYTICS_SALT;
  });
});

describe("the list of events", () => {
  it("is closed, and every call site uses a name from it", () => {
    // Not track(name, props). An open API is how a codebase acquires
    // `photo_uploaded {filename}` — one convenient argument at a time.
    const used = new Set<string>();
    for (const path of walk(root)) {
      for (const m of readFileSync(path, "utf8").matchAll(/name:\s*"([a-z_]+)"\s*[,}]/g)) {
        if ((EVENTS as readonly string[]).includes(m[1])) used.add(m[1]);
      }
    }
    expect(used.size).toBeGreaterThan(8);
    for (const name of used) expect(EVENTS).toContain(name as any);
  });

  it("measures the things that go wrong, not only the things that go right", () => {
    // A dashboard of only good numbers is a dashboard that hides.
    expect(EVENTS).toContain("archive_deleted");
    expect(EVENTS).toContain("stopped_paying");
    expect(EVENTS).toContain("free_cap_reached");
  });

  it("names what is never recorded, and the page shows it", () => {
    expect(NEVER_RECORDED.length).toBeGreaterThanOrEqual(8);
    const page = src("../src/app/admin/funnel/page.tsx");
    expect(page).toContain("NEVER_RECORDED");
  });
});

describe("the funnel", () => {
  it("starts at signing up and ends at paying", () => {
    expect(FUNNEL[0].step).toBe("signed_up");
    expect(FUNNEL[FUNNEL.length - 1].step).toBe("paid");
  });

  it("has a north star that is not a vanity number", () => {
    // Not signups and not revenue: a family who has sent a story has
    // received the thing this product is for and has shown it to somebody
    // who might want their own.
    expect(NORTH_STAR).toBe("story_shared");
    expect(FUNNEL.map((f) => f.step)).toContain(NORTH_STAR);
  });

  it("counts distinct people per step, not events", async () => {
    // Counting events would make a family who uploaded four times look like
    // four families, and every step below the first would look better than
    // it is.
    const rows = [
      { name: "upload_finished", who: "a" },
      { name: "upload_finished", who: "a" },
      { name: "upload_finished", who: "b" },
    ];
    const db = { from: () => ({ select: () => ({ gte: () => ({ limit: async () => ({ data: rows }) }) }) }) } as any;
    expect(await tally(db, "2027-01-01")).toEqual({ upload_finished: 2 });
  });
});

describe("it expires", () => {
  it("keeps less than the archive it describes", () => {
    expect(KEEP_FOR_DAYS).toBeLessThanOrEqual(365);
    expect(migration).toMatch(new RegExp(`interval '${KEEP_FOR_DAYS} days'`));
  });

  it("is actually swept, not merely promised", () => {
    // A retention promise nothing executes is a comment.
    expect(src("../src/lib/jobs/handlers.ts")).toContain("purge_old_analytics");
    expect(migration).toMatch(/create or replace function purge_old_analytics/);
  });

  it("never lets housekeeping stop a family being told what is waiting", () => {
    const handlers = src("../src/lib/jobs/handlers.ts");
    const sweep = handlers.slice(handlers.indexOf("purge_old_analytics") - 200);
    expect(sweep.slice(0, 400)).toMatch(/try \{[\s\S]*?catch/);
  });
});

describe("the family is told this exists", () => {
  it("is on the privacy page, in the section about what we collect", () => {
    // A page headed "what we deliberately don't collect" that quietly
    // omitted the one thing we had started collecting would be the exact
    // failure it exists to prevent.
    const page = src("../src/app/privacy/page.tsx");
    expect(page).toMatch(/We do measure how the product is used/);
    expect(page).toMatch(/no Google Analytics/);
    expect(page).toContain("WINDOW_DAYS");
    expect(page).toContain("KEEP_FOR_DAYS");
  });
});
