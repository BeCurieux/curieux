/**
 * The endpoint's status codes, which are a contract the form reads.
 *
 * `api/events` answers 204 on everything and that is right: a shopper cannot
 * act on a dropped analytics event. This route is the opposite and the
 * difference is the point of the file — a merchant whose message vanished
 * *can* act on it, so 201 means a row exists, 400 means fix a field, and 503
 * means write to us instead. The form renders "Got it" on exactly one of
 * those.
 *
 * The store is swapped for a fake through the module's own default, so these
 * exercise the real handler rather than a re-implementation of it.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import type { EarlyAccessRecord, EarlyAccessStore } from "@/lib/earlyaccess/index";

const recorded: EarlyAccessRecord[] = [];
let failWith: Error | null = null;

vi.mock("@/lib/earlyaccess/index", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/earlyaccess/index")>();
  return {
    ...actual,
    recordEarlyAccess: async (request: Parameters<typeof actual.recordEarlyAccess>[0]) => {
      if (failWith) throw failWith;
      const record = { ...request, id: "fake", receivedAt: "2026-08-17T00:00:00.000Z" } as EarlyAccessRecord;
      recorded.push(record);
      return record;
    },
  };
});

const { POST } = await import("@/app/api/early-access/route");

const GOOD = {
  name: "Ana Ruiz",
  email: "ana@kelpandcotton.com",
  store: "kelpandcotton.com",
  brief: "People arriving from our linen reel.",
};

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/early-access", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

afterEach(() => {
  recorded.length = 0;
  failWith = null;
});

describe("POST /api/early-access", () => {
  it("answers 201 once a row exists", async () => {
    const response = await POST(post(GOOD));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ ok: true });
    expect(recorded).toHaveLength(1);
  });

  it("answers 400 and names the field", async () => {
    const response = await POST(post({ ...GOOD, email: "nope" }));
    expect(response.status).toBe(400);

    const body = (await response.json()) as { ok: boolean; field: string; error: string };
    expect(body.ok).toBe(false);
    expect(body.field).toBe("email");
    expect(body.error).toBeTruthy();
    expect(recorded).toEqual([]);
  });

  it("answers 503 when the write fails, and says where to write instead", async () => {
    // The assertion the whole feature rests on. A handler that caught this and
    // answered 201 would make the form say "thanks" for a message nobody has.
    failWith = new Error("relation \"early_access\" does not exist");

    const response = await POST(post(GOOD));
    expect(response.status).toBe(503);

    const body = (await response.json()) as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toContain("@");
    // And it does not hand the database's own words to a stranger.
    expect(body.error).not.toContain("relation");
  });

  it("refuses a body larger than the cap, by header and by length", async () => {
    const huge = { ...GOOD, brief: "x".repeat(20_000) };

    const byHeader = await POST(post(huge, { "content-length": "20000" }));
    expect(byHeader.status).toBe(400);

    // A lying content-length must not get past it either.
    const byLength = await POST(post(huge, { "content-length": "10" }));
    expect(byLength.status).toBe(400);
    expect(recorded).toEqual([]);
  });

  it("answers 400 rather than throwing on something that is not JSON", async () => {
    const response = await POST(post("not json at all"));
    expect(response.status).toBe(400);
    expect(recorded).toEqual([]);
  });

  it("answers 400 on an empty body", async () => {
    const response = await POST(post(""));
    expect(response.status).toBe(400);
  });

  it("ignores fields nobody asked for", async () => {
    // A form post is not a way to set columns. zod strips unknown keys, and
    // this pins that rather than trusting it.
    await POST(post({ ...GOOD, plan: "pro", id: "chosen-by-the-client" }));
    expect(recorded[0]).not.toHaveProperty("plan");
    expect(recorded[0]?.id).toBe("fake");
  });
});
