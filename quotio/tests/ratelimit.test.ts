import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { LocalStore } from "@/lib/db/local";
import { setStore } from "@/lib/db/store";
import { callerKey, checkRateLimit, windowStart, type RateLimit } from "@/lib/ratelimit";

/**
 * Rate limiting the endpoint that costs money.
 *
 * The thing being protected is an API bill, so the tests that matter are the
 * ones about what happens when somebody is *trying* — a fresh account per
 * request, a forged header, a window boundary — rather than the happy path.
 */
let store: LocalStore;
let directory: string;

const RULE: RateLimit = { limit: 3, windowMs: 60_000 };

beforeEach(() => {
  directory = mkdtempSync(path.join(tmpdir(), "mekmi-rl-"));
  (globalThis as { __mekmiDb?: unknown }).__mekmiDb = undefined;
  store = new LocalStore(path.join(directory, "store.json"));
  setStore(store);
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
  (globalThis as { __mekmiDb?: unknown }).__mekmiDb = undefined;
  setStore(null);
});

describe("counting", () => {
  it("allows up to the limit and refuses the one after", async () => {
    const at = new Date("2026-01-01T12:00:00.000Z");
    const results = [];
    for (let i = 0; i < 4; i += 1) {
      results.push(await checkRateLimit("k", RULE, at));
    }
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
  });

  it("counts down what is left, and stops at zero", async () => {
    const at = new Date("2026-01-01T12:00:00.000Z");
    expect((await checkRateLimit("k", RULE, at)).remaining).toBe(2);
    expect((await checkRateLimit("k", RULE, at)).remaining).toBe(1);
    expect((await checkRateLimit("k", RULE, at)).remaining).toBe(0);
    expect((await checkRateLimit("k", RULE, at)).remaining).toBe(0);
  });

  it("keeps separate keys separate", async () => {
    const at = new Date("2026-01-01T12:00:00.000Z");
    for (let i = 0; i < 3; i += 1) await checkRateLimit("a", RULE, at);

    expect((await checkRateLimit("a", RULE, at)).allowed).toBe(false);
    expect((await checkRateLimit("b", RULE, at)).allowed).toBe(true);
  });

  it("starts again in the next window", async () => {
    const at = new Date("2026-01-01T12:00:30.000Z");
    for (let i = 0; i < 4; i += 1) await checkRateLimit("k", RULE, at);
    expect((await checkRateLimit("k", RULE, at)).allowed).toBe(false);

    const later = new Date(at.getTime() + RULE.windowMs);
    expect((await checkRateLimit("k", RULE, later)).allowed).toBe(true);
  });

  it("does not accumulate a row per window", async () => {
    // Otherwise the table grows once per key per window, forever, to hold
    // counts nothing will ever read again.
    const key = "k";
    for (let w = 0; w < 5; w += 1) {
      await checkRateLimit(key, RULE, new Date(w * RULE.windowMs));
    }
    const raw = JSON.parse(
      require("node:fs").readFileSync(path.join(directory, "store.json"), "utf8")
    );
    expect(raw.rateLimits.filter((row: { key: string }) => row.key === key)).toHaveLength(1);
  });

  it("reports when the window ends, for Retry-After", async () => {
    const at = new Date("2026-01-01T12:00:30.000Z");
    const result = await checkRateLimit("k", RULE, at);
    expect(result.resetAt.toISOString()).toBe("2026-01-01T12:01:00.000Z");
    expect(result.resetAt.getTime()).toBeGreaterThan(at.getTime());
  });
});

describe("window boundaries", () => {
  it("puts a timestamp in the window containing it", () => {
    expect(windowStart(60_000, new Date("2026-01-01T12:00:00.000Z")).toISOString()).toBe(
      "2026-01-01T12:00:00.000Z"
    );
    expect(windowStart(60_000, new Date("2026-01-01T12:00:59.999Z")).toISOString()).toBe(
      "2026-01-01T12:00:00.000Z"
    );
    expect(windowStart(60_000, new Date("2026-01-01T12:01:00.000Z")).toISOString()).toBe(
      "2026-01-01T12:01:00.000Z"
    );
  });
});

describe("who gets counted", () => {
  const request = (headers: Record<string, string>) =>
    new Request("https://mekmi.app/api/generate", { headers });

  it("uses the forwarded address", () => {
    expect(callerKey(request({ "x-forwarded-for": "203.0.113.7" }), "generate")).toBe(
      "generate:203.0.113.7"
    );
  });

  it("takes the client from a proxy chain, not the last proxy", () => {
    expect(
      callerKey(request({ "x-forwarded-for": "203.0.113.7, 70.41.3.18, 150.172.238.178" }), "gen")
    ).toBe("gen:203.0.113.7");
  });

  it("falls back to x-real-ip", () => {
    expect(callerKey(request({ "x-real-ip": "198.51.100.4" }), "gen")).toBe("gen:198.51.100.4");
  });

  it("still produces a key when there is no header at all", () => {
    // Everyone anonymous shares one bucket, which is strict rather than open.
    expect(callerKey(request({}), "gen")).toBe("gen:unknown");
  });

  it("keeps different prefixes apart", () => {
    const headers = { "x-forwarded-for": "203.0.113.7" };
    expect(callerKey(request(headers), "generate")).not.toBe(callerKey(request(headers), "leads"));
  });
});

describe("failing open", () => {
  it("allows the request through when the store cannot count", async () => {
    // A limiter that turns a database wobble into a dead endpoint has become
    // the outage it was there to prevent.
    setStore({
      ...store,
      bumpRateLimit: async () => 0,
    } as unknown as LocalStore);

    const result = await checkRateLimit("k", RULE);
    expect(result.allowed).toBe(true);
  });
});
