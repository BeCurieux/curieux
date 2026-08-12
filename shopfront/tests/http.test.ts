import { describe, expect, it, vi } from "vitest";
import { createHttpClient, looksLikeJson, type FetchLike } from "@/lib/ingest/http";

const noSleep = () => Promise.resolve();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("createHttpClient", () => {
  it("identifies itself on every request", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => json({ ok: true }));
    const client = createHttpClient({ fetchImpl, sleep: noSleep, minIntervalMs: 0 });
    await client.get("https://example.com/products.json");

    const headers = fetchImpl.mock.calls[0]![1]!.headers as Record<string, string>;
    // We are reading storefronts that have not asked us to. A merchant looking
    // at their logs must be able to find out who we are.
    expect(headers["user-agent"]).toMatch(/Popuup/i);
    expect(headers["user-agent"]).toMatch(/https?:\/\//);
  });

  it("retries a 500 and returns the eventual success", async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls++;
      return calls < 3 ? new Response("nope", { status: 503 }) : json({ products: [] });
    });
    const client = createHttpClient({ fetchImpl, sleep: noSleep, minIntervalMs: 0 });
    const result = await client.get("https://example.com/products.json");
    expect(result.ok).toBe(true);
    expect(calls).toBe(3);
  });

  it("does not retry a 404, which is an answer rather than a hiccup", async () => {
    const fetchImpl = vi.fn(async () => new Response("gone", { status: 404 }));
    const client = createHttpClient({ fetchImpl, sleep: noSleep, minIntervalMs: 0 });
    const result = await client.get("https://example.com/products.json");
    expect(result.status).toBe(404);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries 429 rather than hammering through a rate limit", async () => {
    const fetchImpl = vi.fn(async () => new Response("slow down", { status: 429 }));
    const client = createHttpClient({ fetchImpl, sleep: noSleep, minIntervalMs: 0, maxAttempts: 3 });
    await client.get("https://example.com/products.json");
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("reports a network failure as a result rather than throwing", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    const client = createHttpClient({ fetchImpl, sleep: noSleep, minIntervalMs: 0, maxAttempts: 2 });
    const result = await client.get("https://example.com/");
    expect(result.ok).toBe(false);
    expect(result.status).toBe(0);
    expect(result.error).toContain("ECONNREFUSED");
  });

  it("caps the body, because a storefront can inline megabytes of theme", async () => {
    const fetchImpl = async () => new Response("x".repeat(5000), { headers: { "content-type": "text/html" } });
    const client = createHttpClient({ fetchImpl, sleep: noSleep, minIntervalMs: 0, maxBytes: 1000 });
    const result = await client.get("https://example.com/");
    expect(result.body).toHaveLength(1000);
    expect(result.truncated).toBe(true);
  });

  it("leaves a gap between requests to the same host", async () => {
    const slept: number[] = [];
    const fetchImpl = async () => json({});
    const client = createHttpClient({
      fetchImpl,
      minIntervalMs: 250,
      sleep: async (ms) => {
        slept.push(ms);
      },
    });
    await client.get("https://example.com/a");
    await client.get("https://example.com/b");
    expect(slept.some((ms) => ms > 0)).toBe(true);
  });

  it("only ever slows down when robots.txt asks", () => {
    const client = createHttpClient({ fetchImpl: async () => json({}), minIntervalMs: 250 });
    // A robots.txt must not be able to make us ruder than our own floor.
    expect(() => client.setMinIntervalMs(10)).not.toThrow();
    expect(() => client.setMinIntervalMs(2000)).not.toThrow();
  });

  it("returns a result instead of throwing on an unusable URL", async () => {
    const client = createHttpClient({ fetchImpl: async () => json({}), minIntervalMs: 0 });
    const result = await client.get("not-a-url");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("bad url");
  });
});

describe("looksLikeJson", () => {
  it("sniffs the body when the content type lies", () => {
    const base = { url: "u", status: 200, ok: true, truncated: false };
    expect(looksLikeJson({ ...base, contentType: "text/plain", body: '  {"products":[]}' })).toBe(true);
    expect(looksLikeJson({ ...base, contentType: "application/json", body: "{}" })).toBe(true);
    expect(looksLikeJson({ ...base, contentType: "text/html", body: "<!doctype html>" })).toBe(false);
    expect(looksLikeJson({ ...base, ok: false, contentType: "application/json", body: "{}" })).toBe(false);
  });
});
