/**
 * The contact form's back end.
 *
 * This is the Sprint 3 gate that was opened deliberately, so it gets tested
 * like something that can lose somebody's message rather than like a form.
 * The assertions that matter are the failure ones:
 *
 *   - a write that throws must reach the caller, because the route turns that
 *     into a 503 and the form tells the person to email instead. A store that
 *     swallowed its own failure would make the whole page a lie;
 *   - a duplicate must succeed, because somebody who submits twice out of
 *     uncertainty has not done anything wrong;
 *   - the time is stamped by the server, not by the request.
 */

import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  EarlyAccessRequest,
  LIMITS,
  normaliseStore,
  recordEarlyAccess,
  type EarlyAccessStore,
} from "@/lib/earlyaccess/index";
import { createLocalEarlyAccessStore } from "@/lib/earlyaccess/store";

const GOOD = {
  name: "Ana Ruiz",
  email: "ana@kelpandcotton.com",
  store: "kelpandcotton.com",
  brief: "People arriving from our linen reel. Nothing over £150.",
};

async function localStore() {
  const dir = await mkdtemp(path.join(tmpdir(), "popuup-early-"));
  return { dir, store: createLocalEarlyAccessStore({ dir }) };
}

describe("what the form accepts", () => {
  it("takes a plain request", () => {
    expect(EarlyAccessRequest.safeParse(GOOD).success).toBe(true);
  });

  it("does not require a brief", () => {
    const { brief: _brief, ...withoutBrief } = GOOD;
    expect(EarlyAccessRequest.safeParse(withoutBrief).success).toBe(true);
  });

  it.each([
    ["no @", "anakelpandcotton.com"],
    ["no dot in the domain", "ana@kelpandcotton"],
    ["a space", "ana ruiz@kelpandcotton.com"],
    ["nothing before the @", "@kelpandcotton.com"],
  ])("refuses an address with %s", (_why, email) => {
    expect(EarlyAccessRequest.safeParse({ ...GOOD, email }).success).toBe(false);
  });

  it.each([
    ["a plus tag", "ana+shops@kelpandcotton.com"],
    ["a subdomain", "ana@mail.kelpandcotton.co.uk"],
    ["a dot in the local part", "ana.ruiz@kelpandcotton.com"],
    ["an apostrophe", "ana.o'brien@kelpandcotton.com"],
  ])("accepts a real address with %s", (_why, email) => {
    // The check is deliberately permissive. Every "strict" email pattern in
    // circulation rejects somebody's real address, and the only proof an
    // address works is sending to it.
    expect(EarlyAccessRequest.safeParse({ ...GOOD, email }).success).toBe(true);
  });

  it("refuses an empty name and an empty store", () => {
    expect(EarlyAccessRequest.safeParse({ ...GOOD, name: "   " }).success).toBe(false);
    expect(EarlyAccessRequest.safeParse({ ...GOOD, store: "" }).success).toBe(false);
  });

  it("caps every field", () => {
    expect(EarlyAccessRequest.safeParse({ ...GOOD, brief: "x".repeat(LIMITS.brief) }).success).toBe(true);
    expect(EarlyAccessRequest.safeParse({ ...GOOD, brief: "x".repeat(LIMITS.brief + 1) }).success).toBe(false);
    expect(EarlyAccessRequest.safeParse({ ...GOOD, name: "x".repeat(LIMITS.name + 1) }).success).toBe(false);
  });

  it("reports which field was wrong", () => {
    // The route sends this back and the form attaches it to the input. A
    // summary at the top of a four-field form makes a person hunt.
    const parsed = EarlyAccessRequest.safeParse({ ...GOOD, email: "nope" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0]?.path[0]).toBe("email");
  });
});

describe("normalising a store", () => {
  it.each([
    ["kelpandcotton.com", "kelpandcotton.com"],
    ["https://kelpandcotton.com", "kelpandcotton.com"],
    ["http://www.kelpandcotton.com/", "kelpandcotton.com"],
    ["WWW.KelpAndCotton.com", "kelpandcotton.com"],
    ["kelpandcotton.com/collections/new", "kelpandcotton.com/collections/new"],
  ])("reads %s as %s", (input, expected) => {
    expect(normaliseStore(input)).toBe(expected);
  });

  it("keeps a path, because a collection URL says more than a domain", () => {
    expect(normaliseStore("https://kelpandcotton.com/collections/linen/")).toBe("kelpandcotton.com/collections/linen");
  });

  it("leaves something unparseable alone rather than mangling it", () => {
    // This is a note for a human to read, not a key anything is looked up by.
    expect(normaliseStore("the one on etsy, ask me")).toBe("the one on etsy, ask me");
  });
});

describe("recording a request", () => {
  it("writes a row and stamps the time itself", async () => {
    const { store } = await localStore();
    const record = await recordEarlyAccess(GOOD, { store });

    expect(record.id).toBeTruthy();
    expect(Number.isNaN(Date.parse(record.receivedAt))).toBe(false);
    expect(record.email).toBe(GOOD.email);
  });

  it("normalises the store on the way in", async () => {
    const { store } = await localStore();
    const record = await recordEarlyAccess({ ...GOOD, store: "HTTPS://WWW.KelpAndCotton.com/" }, { store });
    expect(record.store).toBe("kelpandcotton.com");
  });

  it("drops a brief that is only whitespace rather than storing one", async () => {
    const { store } = await localStore();
    const record = await recordEarlyAccess({ ...GOOD, brief: "   \n  " }, { store });
    expect(record.brief).toBeUndefined();
  });

  it("accepts the same person twice", async () => {
    // No unique constraint, on purpose. Somebody who submits again because
    // they were not sure it worked has not done anything wrong, and a
    // rejection they cannot interpret is worse than a duplicate a human clears
    // in a second.
    const { store } = await localStore();
    await recordEarlyAccess(GOOD, { store });
    await expect(recordEarlyAccess(GOOD, { store })).resolves.toBeTruthy();
    expect(await store.list()).toHaveLength(2);
  });

  it("lets a failed write reach the caller", async () => {
    // The assertion the whole feature rests on. The route turns this into a
    // 503 and the form shows an address to email instead; a store that
    // swallowed it would make the page say "thanks" for a message nobody has.
    const broken: EarlyAccessStore = {
      name: "broken",
      record: () => Promise.reject(new Error("no such table")),
      list: () => Promise.resolve([]),
    };
    await expect(recordEarlyAccess(GOOD, { store: broken })).rejects.toThrow("no such table");
  });
});

describe("the local store", () => {
  it("appends rather than rewrites", async () => {
    const { dir, store } = await localStore();
    await store.record({ ...GOOD, name: "First" });
    await store.record({ ...GOOD, name: "Second" });

    const raw = await readFile(path.join(dir, "early-access.ndjson"), "utf8");
    expect(raw.trim().split("\n")).toHaveLength(2);
  });

  it("survives a truncated last line", async () => {
    const { dir, store } = await localStore();
    await store.record(GOOD);
    const { appendFile } = await import("node:fs/promises");
    await appendFile(path.join(dir, "early-access.ndjson"), '{"id":"half', "utf8");

    // One bad line loses one record, which is the correct read of an
    // append-only log interrupted mid-write.
    expect(await store.list()).toHaveLength(1);
  });

  it("reads back newest first", async () => {
    // The clock is injected rather than slept through. Two appends inside the
    // same millisecond sort arbitrarily, which is a flake that shows up once a
    // fortnight on a fast machine and never on the one you debug it on.
    const { dir } = await localStore();
    let tick = 0;
    const store = createLocalEarlyAccessStore({
      dir,
      now: () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)),
    });

    await store.record({ ...GOOD, name: "Older" });
    await store.record({ ...GOOD, name: "Newer" });

    expect((await store.list()).map((row) => row.name)).toEqual(["Newer", "Older"]);
  });

  it("returns nothing before anybody has written in", async () => {
    const { store } = await localStore();
    expect(await store.list()).toEqual([]);
  });
});
