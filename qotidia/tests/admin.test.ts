// The operator's tools, and the line they may not cross.
//
// Two things here, and they pull in opposite directions.
//
// The first is that a solo founder has to be able to tell whether the product
// is running. The failure this guards is the quiet one: a job runner that has
// stopped announces itself nowhere — uploads still work, the archive still
// opens, and it is three days later, when a family asks why their book never
// came, that anybody finds out. A queue with a thousand things in it and no
// runner looks exactly like an empty queue from every page except this one.
//
// The second is that being able to answer a support email must not become
// being able to read an archive. 0026 made the grant a real key and this is
// the page most likely to route around it, because routing around it would be
// so convenient — the answer is right there, and asking feels like ceremony.
// So the lookup returns the account and never the archive, and that is
// checked rather than intended.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { codeOnly as bare } from "./helpers/source";
import {
  SLOW_MINUTES, STALE_MINUTES, healthOf, needsSomebody, type Queue,
} from "@/lib/admin/health";
import { NOT_HERE, findByEmail } from "@/lib/admin/accounts";

const src = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const lookup = src("../src/lib/admin/accounts.ts");
const page = src("../src/app/admin/accounts/page.tsx");
const dashboard = src("../src/app/admin/page.tsx");

const NOW = "2027-06-01T12:00:00.000Z";
const ago = (minutes: number) =>
  new Date(Date.parse(NOW) - minutes * 60_000).toISOString();
const queue = (patch: Partial<Queue> = {}): Queue => ({
  queued: 0, running: 0, failed: 0, dead: 0,
  lastFinishedAt: ago(1), oldestWaitingAt: null,
  ...patch,
});

describe("a stopped runner is loud", () => {
  it("is the failure that announces itself nowhere else", () => {
    const health = healthOf(
      queue({ queued: 40, lastFinishedAt: ago(STALE_MINUTES + 5), oldestWaitingAt: ago(60) }),
      NOW
    );
    expect(health.verdict).toBe("stopped");
    expect(health.because).toMatch(/runner is probably not running/i);
    expect(needsSomebody(health)).toBe(true);
  });

  it("needs work waiting as well as silence, so a quiet 4am is healthy", () => {
    // Queue depth on its own means nothing and silence on its own means
    // nothing. Only both together mean the runner is gone.
    const quiet = healthOf(queue({ lastFinishedAt: ago(60 * 12) }), NOW);
    expect(quiet.verdict).toBe("fine");
  });

  it("copes with a queue that has never finished anything", () => {
    // A brand new deployment, or one where the runner never started at all.
    const health = healthOf(queue({ queued: 3, lastFinishedAt: null, oldestWaitingAt: ago(60) }), NOW);
    expect(health.verdict).toBe("stopped");
    expect(health.because).not.toMatch(/Infinity|NaN/);
  });

  it("waits long enough not to cry wolf over a slow book", () => {
    expect(STALE_MINUTES).toBeGreaterThanOrEqual(10);
    expect(STALE_MINUTES).toBeLessThanOrEqual(60);
    const rendering = healthOf(
      queue({ running: 1, lastFinishedAt: ago(STALE_MINUTES - 5), oldestWaitingAt: ago(STALE_MINUTES - 5) }),
      NOW
    );
    expect(rendering.verdict).not.toBe("stopped");
  });
});

describe("the rest of the verdicts", () => {
  it("puts a stopped runner above a stuck job", () => {
    // One of them means everything is broken and the other means one thing
    // is. Both true at once should read as the worse.
    const both = healthOf(
      queue({ queued: 5, dead: 2, lastFinishedAt: ago(60), oldestWaitingAt: ago(60) }),
      NOW
    );
    expect(both.verdict).toBe("stopped");
  });

  it("treats a job that has given up as needing somebody", () => {
    // No retry will fix it, and each one is a family waiting for something
    // that will never arrive.
    const health = healthOf(queue({ dead: 1 }), NOW);
    expect(health.verdict).toBe("stuck");
    expect(health.because).toMatch(/somebody is waiting/i);
    expect(needsSomebody(health)).toBe(true);
  });

  it("counts one job in the singular", () => {
    // The same grammar rule as everywhere else in this product.
    expect(healthOf(queue({ dead: 1 }), NOW).because).toMatch(/1 job has given up/);
    expect(healthOf(queue({ dead: 3 }), NOW).because).toMatch(/3 jobs have given up/);
    const one = healthOf(queue({ queued: 1, lastFinishedAt: ago(60), oldestWaitingAt: ago(60) }), NOW);
    expect(one.because).toMatch(/1 job waiting/);
  });

  it("says slow rather than broken when things are still moving", () => {
    const health = healthOf(
      queue({ queued: 2, lastFinishedAt: ago(2), oldestWaitingAt: ago(SLOW_MINUTES + 5) }),
      NOW
    );
    expect(health.verdict).toBe("slow");
    expect(needsSomebody(health)).toBe(false);
  });

  it("says nothing at all when there is nothing to say", () => {
    const health = healthOf(queue({ queued: 2, oldestWaitingAt: ago(1) }), NOW);
    expect(health.verdict).toBe("fine");
    expect(health.because).toBeNull();
  });

  it("is the first thing on the page, and marked when it matters", () => {
    expect(dashboard.indexOf("health.verdict")).toBeLessThan(dashboard.indexOf("Failed jobs"));
    expect(dashboard).toContain("needsSomebody(health)");
  });
});

describe("the lookup answers an email, and opens no archive", () => {
  it("returns the account and nothing from the archive", () => {
    // The line 0026 drew, and this is the page most likely to route around
    // it — because routing around it would be so convenient.
    // Up to NOT_HERE, which is by definition a list of the forbidden words
    // and would otherwise fail the rule it exists to state — the same trap
    // the storage guard, the asking test and the support promise all hit.
    const code = bare(lookup).slice(0, bare(lookup).indexOf("export const NOT_HERE"));
    for (const forbidden of ["display_name", "date_of_birth", "raw_text",
                             "transcript", "storage_path", "memory_date", "title"]) {
      expect(code, forbidden).not.toContain(forbidden);
    }
    expect(NOT_HERE.length).toBeGreaterThanOrEqual(4);
    expect(page).toContain("NOT_HERE");
  });

  it("reports the free cap as a state, never as a count", () => {
    // "Why can't I add anything?" is answerable from the state. The number
    // is the size of their archive, which is theirs.
    expect(lookup).toMatch(/atFreeCap: boolean/);
    // The declared fields, without the comments describing them — one of
    // which says "never the count itself" and contains the word.
    // The field names alone. "Account" contains "count", which is the sort
    // of thing that makes a guard look broken when it is the assertion that
    // is careless.
    const clean = bare(lookup);
    const fields = clean
      .slice(clean.indexOf("export interface Account"), clean.indexOf("}", clean.indexOf("export interface Account")))
      .split("\n")
      .slice(1)
      .map((l) => l.trim().split(":")[0])
      .filter(Boolean);
    expect(fields).toContain("atFreeCap");
    for (const f of fields) expect(f, f).not.toMatch(/memories|kept|count/i);
    expect(page).not.toMatch(/a\.kept|a\.memories/);
  });

  it("says which side of the grant it is on, either way", () => {
    expect(page).toMatch(/a\.grantOpenUntil \?/);
    expect(page).toMatch(/No access to their archive/);
    expect(page).toMatch(/it is one button in their settings/);
  });

  it("hands off to the granted view rather than duplicating it", () => {
    expect(page).toMatch(/\/admin\/support\/\$\{a\.familyId\}/);
  });
});

describe("it is a lookup, not a way to browse customers", () => {
  it("needs a whole address before it does anything", () => {
    expect(lookup).toMatch(/if \(!wanted\.includes\("@"\)\) return \[\]/);
  });

  it("matches exactly, never by prefix or pattern", () => {
    // A search box that returns everybody matching "sa" is a browsing tool
    // wearing a lookup's clothes.
    const code = bare(lookup);
    expect(code).not.toMatch(/\.ilike\(|\.like\(|textSearch|%\$\{/);
    expect(code).toMatch(/\.eq\("email", wanted\)/);
  });

  it("finds nobody for a partial address", async () => {
    let asked = false;
    const db = { from: () => { asked = true; return {} as any; } } as any;
    expect(await findByEmail(db, "sar")).toEqual([]);
    expect(asked).toBe(false);
  });

  it("lowercases, because people capitalise their own addresses", async () => {
    const seen: any[] = [];
    const db = {
      from: () => ({
        select: () => ({
          eq: (_c: string, v: string) => { seen.push(v); return { maybeSingle: async () => ({ data: null }) }; },
        }),
      }),
    } as any;
    await findByEmail(db, "  Them@Example.COM ");
    expect(seen[0]).toBe("them@example.com");
  });
});

describe("staff only, in the app as well as the database", () => {
  it("checks is_admin and sends everybody else home", () => {
    for (const [name, code] of [["accounts", page], ["dashboard", dashboard]] as const) {
      expect(code, name).toMatch(/is_admin/);
      expect(code, name).toMatch(/redirect\("\/home"\)/);
    }
  });

  it("stays out of any index", () => {
    expect(src("../src/app/robots.ts")).toContain('"/admin"');
  });

  it("changes nothing about a family from here", () => {
    // The one control on the admin dashboard retries a job. Nothing on
    // either page edits an account, a plan or an archive.
    expect(bare(page)).not.toMatch(/\.update\(|\.insert\(|\.delete\(|"use server"/);
    const controls = bare(dashboard).match(/<form action=\{(\w+)\}/g) ?? [];
    expect(controls).toEqual(["<form action={adminRetryJob}"]);
  });
});
