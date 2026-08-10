// What the model costs, and the ceiling it may not go through.
//
// Two tests here are load-bearing and the rest support them.
//
// The first is that an unknown model is not free. Zero is the number that
// makes every ceiling infinite and every dashboard green, and it arrives by
// changing one environment variable — AI_MODEL to a name released last
// Tuesday. Failing expensive means a ceiling stops early and somebody
// investigates; failing free means a bill.
//
// The second is that an unmetered call throws. The whole point of building a
// meter rather than writing `await log(...)` after each call site is that the
// second one can be forgotten, silently, by somebody adding a seventh method
// to the provider in a year.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  EVERYBODY_DAILY, FAMILY_MONTHLY, NEVER_LOGGED, PER_DOLLAR, PRICES,
  UNKNOWN_MODEL, WARN_AT, asMoney, costOf, mayCall, priceOf,
} from "@/lib/ai/cost";
import { OverBudget, metered, meter, spend } from "@/lib/ai/meter";
import { PLAN_PRICES } from "@/lib/billing/plans";

const src = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const migration = src("../supabase/migrations/0030_ai_cost.sql");
const adapter = src("../src/lib/ai/anthropic.ts");
const bare = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*(\/\/|--|\*).*$/gm, "");

/** A client that records what was written. */
function fakeDb(existing: any[] = []) {
  const written: any[] = [];
  const q: any = {
    select: () => q,
    eq: () => q,
    gte: async () => ({ data: existing }),
    insert: async (row: any) => {
      written.push(row);
      return {};
    },
  };
  // gte is the terminal call in spentSoFar; make the chain thenable too.
  q.then = (res: any) => Promise.resolve({ data: existing }).then(res);
  return { written, db: { from: () => q } as any };
}

describe("a model we have never heard of is not free", () => {
  it("costs more than anything we would actually run", () => {
    // The whole argument, in one assertion.
    for (const price of Object.values(PRICES)) {
      expect(UNKNOWN_MODEL.inPerM).toBeGreaterThan(price.inPerM);
      expect(UNKNOWN_MODEL.outPerM).toBeGreaterThan(price.outPerM);
    }
    expect(costOf("claude-something-released-on-tuesday", 1_000_000, 1_000_000))
      .toBeGreaterThan(costOf("claude-sonnet-5", 1_000_000, 1_000_000));
  });

  it("never prices anything at zero", () => {
    for (const [model, price] of Object.entries(PRICES)) {
      expect(price.inPerM, model).toBeGreaterThan(0);
      expect(price.outPerM, model).toBeGreaterThan(0);
    }
    expect(costOf("anything", 1, 1)).toBeGreaterThan(0);
  });

  it("can be corrected from the environment without a deploy", () => {
    // Prices are a fact about the world, not about this codebase.
    process.env.AI_PRICE_TEST_MODEL = "111/222";
    expect(priceOf("test-model")).toEqual({ inPerM: 111, outPerM: 222 });
    delete process.env.AI_PRICE_TEST_MODEL;
  });

  it("ignores an override that is not two numbers", () => {
    process.env.AI_PRICE_TEST_MODEL = "not-a-price";
    expect(priceOf("test-model")).toEqual(UNKNOWN_MODEL);
    delete process.env.AI_PRICE_TEST_MODEL;
  });

  it("rounds up, so the number is never flattering", () => {
    expect(costOf("claude-sonnet-5", 1, 0)).toBeGreaterThan(0);
  });
});

describe("an unmetered call is a bug, not an omission", () => {
  it("throws rather than quietly not counting", () => {
    expect(metered()).toBe(false);
    expect(() => spend("claude-sonnet-5", 100, 100)).toThrow(/metered scope/);
  });

  it("is called at the one place the adapter talks to a model", () => {
    // Every method funnels through json(), which is why the accounting is
    // there rather than at six call sites.
    const code = bare(adapter);
    expect((code.match(/messages\.create\(/g) ?? []).length).toBe(1);
    expect((code.match(/spend\(/g) ?? []).length).toBe(1);
    const json = code.slice(code.indexOf("private async json"));
    expect(json.slice(0, json.indexOf("return"))).toContain("spend(this.model");
  });

  it("counts tokens and nothing else", () => {
    // Not the prompt, not the reply. A cost log that kept those would be a
    // second copy of the archive, held for accounting.
    const start = adapter.indexOf("spend(this.model");
    const call = adapter.slice(start, adapter.indexOf(";", start));
    expect(call).toMatch(/usage\?\.input_tokens/);
    expect(call).toMatch(/usage\?\.output_tokens/);
    expect(call).not.toMatch(/prompt|system|content|text/);
  });
});

describe("the ceilings", () => {
  it("stop a family before the plan stops making sense", () => {
    // A couple of dollars a month against A$19, so the margin the printing
    // needs survives.
    expect(FAMILY_MONTHLY).toBeLessThan(PLAN_PRICES.monthlyAud() * (PER_DOLLAR / 100) * 0.25);
    expect(FAMILY_MONTHLY).toBeGreaterThan(0);
  });

  it("check everybody before they check anybody", () => {
    // When everything is on fire, "which family" is not the interesting
    // question.
    const answer = mayCall({ familyMonth: 0, everybodyToday: EVERYBODY_DAILY });
    expect(answer.ok).toBe(false);
    expect(answer.because).toBe("everybody over budget");
  });

  it("stop one family without stopping the rest", () => {
    const answer = mayCall({ familyMonth: FAMILY_MONTHLY, everybodyToday: 0 });
    expect(answer.ok).toBe(false);
    expect(answer.because).toBe("family over budget");
  });

  it("warn before they refuse", () => {
    expect(WARN_AT).toBeGreaterThan(0.5);
    expect(WARN_AT).toBeLessThan(1);
    const answer = mayCall({ familyMonth: FAMILY_MONTHLY * WARN_AT, everybodyToday: 0 });
    expect(answer.ok).toBe(true);
    expect(answer.warn).toBe(true);
  });

  it("let an ordinary family through without a murmur", () => {
    expect(mayCall({ familyMonth: 0, everybodyToday: 0 })).toEqual({ ok: true, warn: false });
  });
});

describe("the meter", () => {
  it("checks the ceiling before the work, not after", async () => {
    // A refusal that arrives once the money is spent is a receipt, not a
    // control.
    const { db, written } = fakeDb([{ cost: EVERYBODY_DAILY }]);
    let ran = false;
    await expect(
      meter(db, { familyId: "f1", kind: "cluster" }, async () => {
        ran = true;
      })
    ).rejects.toBeInstanceOf(OverBudget);
    expect(ran).toBe(false);
  });

  it("records the refusal, so a stalled family is explicable", async () => {
    // A refusal that leaves no trace is indistinguishable from nothing
    // having been attempted.
    const { db, written } = fakeDb([{ cost: EVERYBODY_DAILY }]);
    await meter(db, { familyId: "f1", kind: "cluster" }, async () => {}).catch(() => {});
    expect(written).toHaveLength(1);
    expect(written[0].refused).toBe("everybody over budget");
    expect(written[0].cost).toBe(0);
  });

  it("writes what a job used, once, however many calls it made", async () => {
    const { db, written } = fakeDb();
    await meter(db, { familyId: "f1", kind: "structure" }, async () => {
      spend("claude-sonnet-5", 1000, 500);
      spend("claude-sonnet-5", 2000, 700);
    });
    expect(written).toHaveLength(1);
    expect(written[0].input_tokens).toBe(3000);
    expect(written[0].output_tokens).toBe(1200);
    expect(written[0].cost).toBe(costOf("claude-sonnet-5", 3000, 1200));
  });

  it("writes the row even when the work throws", async () => {
    // A failed job that burned forty thousand tokens still burned them, and
    // a log that only records successes under-reports exactly when
    // something is going wrong.
    const { db, written } = fakeDb();
    await expect(
      meter(db, { familyId: "f1", kind: "copy" }, async () => {
        spend("claude-sonnet-5", 40_000, 0);
        throw new Error("the model returned nonsense");
      })
    ).rejects.toThrow(/nonsense/);
    expect(written).toHaveLength(1);
    expect(written[0].input_tokens).toBe(40_000);
  });

  it("writes nothing when no call was made", async () => {
    const { db, written } = fakeDb();
    await meter(db, { familyId: "f1", kind: "edit" }, async () => "no model needed");
    expect(written).toEqual([]);
  });

  it("refuses rather than crashing when the budget cannot be read", async () => {
    // The opposite of the call storage/usage.ts makes, deliberately. There a
    // family we cannot read is given room, because refusing somebody's
    // photographs during our own outage happens in front of them. Here
    // nobody is waiting: these are background jobs that retry, and failing
    // open on a spending ceiling during an outage is how a retry storm
    // becomes an invoice.
    const db = { from: () => { throw new Error("database is on fire"); } } as any;
    let ran = false;
    await expect(
      meter(db, { familyId: "f1", kind: "cluster" }, async () => { ran = true; })
    ).rejects.toBeInstanceOf(OverBudget);
    expect(ran).toBe(false);
  });

  it("still never fails the work over a logging error", async () => {
    // Reading the budget is the control; writing the row is bookkeeping,
    // and bookkeeping must not take a job down.
    let reads = 0;
    const db = {
      from: () => {
        reads += 1;
        const q: any = {
          select: () => q, eq: () => q,
          gte: async () => ({ data: [] }),
          then: (res: any) => Promise.resolve({ data: [] }).then(res),
          insert: () => { throw new Error("write failed"); },
        };
        return q;
      },
    } as any;
    await expect(
      meter(db, { familyId: "f1", kind: "cluster" }, async () => {
        spend("claude-sonnet-5", 10, 10);
        return "fine";
      })
    ).resolves.toBe("fine");
    expect(reads).toBeGreaterThan(0);
  });
});

describe("what the table holds", () => {
  it("has no prompt, no reply and no memory text", () => {
    // Column names, not the whole DDL — several columns are of type `text`,
    // which is not the same as a column holding somebody's text.
    const table = migration.slice(
      migration.indexOf("create table if not exists ai_calls"),
      migration.indexOf(");", migration.indexOf("create table if not exists ai_calls"))
    );
    const columns = table
      .split("\n")
      .map((l) => l.trim().split(/\s+/)[0])
      .filter((n) => /^[a-z_]+$/.test(n));
    for (const forbidden of ["prompt", "response", "reply", "content", "text",
                             "transcript", "message", "system", "body"]) {
      expect(columns, forbidden).not.toContain(forbidden);
    }
    expect(columns).toContain("input_tokens");
    expect(NEVER_LOGGED.length).toBeGreaterThanOrEqual(4);
    // Set as body copy, like the other trust modules.
    for (const x of NEVER_LOGGED) expect(x, x).not.toContain("'");
  });

  it("does record which family, unlike the analytics table", () => {
    // Not an inconsistency. Cost is an operational fact about an account in
    // the way storage_bytes already is, and "what did we spend on this
    // account" is meaningless without it.
    expect(migration).toMatch(/family_id\s+uuid references families\(id\)/);
  });

  it("keeps the accounting when a family erases themselves", () => {
    // on delete set null, not cascade: work already done did not become
    // untrue, and what remains says nothing about them.
    expect(migration).toMatch(/on delete set null/);
  });

  it("is readable by nobody holding the publishable key", () => {
    expect(migration).toMatch(/alter table ai_calls enable row level security/);
    expect(migration).not.toMatch(/create policy .* on ai_calls/);
  });

  it("is swept, like everything else that accumulates", () => {
    expect(migration).toMatch(/create or replace function purge_old_ai_calls/);
    expect(src("../src/lib/jobs/handlers.ts")).toContain("purge_old_ai_calls");
  });
});

describe("reading the numbers", () => {
  it("says money the way a person says it", () => {
    expect(asMoney(PER_DOLLAR * 3.5)).toBe("A$3.50");
    expect(asMoney(PER_DOLLAR * 0.12)).toBe("12.0c");
    expect(asMoney(1)).toBe("under 1c");
    // Nothing is not "under 1c" — the empty dashboard read as though a
    // fraction of a cent had been spent, which is a different claim.
    expect(asMoney(0)).toBe("nothing");
  });

  it("puts the per-family figure on the page, not just the total", () => {
    // A total tells you what happened; a per-family figure tells you whether
    // the business works.
    const page = src("../src/app/admin/spend/page.tsx");
    expect(page).toMatch(/Typical family/);
    expect(page).toMatch(/decides whether the price works/);
  });

  it("surfaces refusals rather than leaving them in a log", () => {
    const page = src("../src/app/admin/spend/page.tsx");
    expect(page).toMatch(/refused by a ceiling/);
    expect(page).toMatch(/Somebody is waiting/);
  });
});
