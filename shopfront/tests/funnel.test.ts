/**
 * The funnel: what is recorded, what is refused, and what the numbers mean.
 *
 * The rule that shapes most of this is that a client may say *what* happened
 * and never *where to file it* — otherwise the events table is writable by
 * anyone with the URL.
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createLocalEventStore, recordEvents, readFunnel, summarise } from "@/lib/funnel/index";
import { FunnelEventBatch, FunnelEventBody } from "@/lib/funnel/event";
import { readSource } from "@/lib/funnel/source";
import { createLocalStore, publishShop } from "@/lib/publish/index";
import type { EventStore } from "@/lib/funnel/store";
import type { ShopStore } from "@/lib/publish/store";
import type { FunnelEvent } from "@/lib/funnel/types";
import { ShopConfig } from "@/lib/schema";
import type { Catalogue, IngestResult } from "@/lib/ingest/types";

const CATALOGUE: Catalogue = {
  currency: "GBP",
  products: [
    {
      handle: "oat-crew",
      title: "Oat Crew",
      description: "",
      tags: [],
      url: "https://kelpandcotton.com/products/oat-crew",
      images: [],
      variants: [{ id: "41001", title: "S", price: 148, available: true, options: ["S"] }],
      price: { min: 148, max: 148 },
      available: true,
      availabilityKnown: true,
    },
  ],
  productCount: 1,
  truncated: false,
};

const INGEST = {
  store: { storeUrl: "https://kelpandcotton.com", ingestedAt: "2026-08-01T09:00:00.000Z" },
  brand: { name: "Kelp & Cotton", storeUrl: "https://kelpandcotton.com" },
  catalogue: CATALOGUE,
} as unknown as IngestResult;

const CONFIG = ShopConfig.parse({
  version: 1,
  brand: { name: "Kelp & Cotton", storeUrl: "https://kelpandcotton.com" },
  theme: {
    colorway: { background: "#faf8f4", surface: "#f0ebe1", text: "#22201d", accent: "#2f5d50" },
    typography: "editorial-serif",
    mood: "editorial",
    density: "regular",
    cornerRadius: "soft",
  },
  blocks: [{ id: "hero", block: { type: "hero", headline: "Made to be mended" } }],
  meta: { prompt: "a warm gift edit", generatedAt: "2026-08-01T09:00:00.000Z" },
});

let dir: string;
let shops: ShopStore;
let events: EventStore;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "popuup-funnel-"));
  shops = createLocalStore({ dir });
  events = createLocalEventStore({ dir });
  await publishShop({ config: CONFIG, ingest: INGEST, slug: "kelp" }, { store: shops });
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const SESSION = "abcdefghij123456";

describe("the wire format", () => {
  it("accepts what the client is allowed to send", () => {
    expect(
      FunnelEventBody.safeParse({ slug: "kelp", sessionId: SESSION, type: "view", source: "instagram" }).success,
    ).toBe(true);
  });

  it("refuses a shop id, a version or a timestamp from a client", () => {
    // The server resolves those. A client that could name them could attribute
    // anybody's numbers to anything.
    for (const extra of [{ shopId: "x" }, { versionId: "x" }, { createdAt: "2026-01-01" }, { plan: "pro" }]) {
      const body = { slug: "kelp", sessionId: SESSION, type: "view", ...extra };
      expect(FunnelEventBody.safeParse(body).success, JSON.stringify(extra)).toBe(false);
    }
  });

  it("refuses an event type outside the closed set", () => {
    expect(FunnelEventBody.safeParse({ slug: "kelp", sessionId: SESSION, type: "add_to_cart" }).success).toBe(false);
  });

  it("refuses a session id that is not the shape we generate", () => {
    for (const sessionId of ["", "short", "a".repeat(64), "HasCapitals12345", "has-dashes-1234567"]) {
      expect(FunnelEventBody.safeParse({ slug: "kelp", sessionId, type: "view" }).success, sessionId).toBe(false);
    }
  });

  it("bounds a batch, so one request cannot be a payload", () => {
    const one = { slug: "kelp", sessionId: SESSION, type: "view" as const };
    expect(FunnelEventBatch.safeParse({ events: Array(20).fill(one) }).success).toBe(true);
    expect(FunnelEventBatch.safeParse({ events: Array(21).fill(one) }).success).toBe(false);
    expect(FunnelEventBatch.safeParse({ events: [] }).success).toBe(false);
  });
});

describe("recording", () => {
  it("stamps the version the server is currently serving", async () => {
    const { recorded } = await recordEvents([{ slug: "kelp", sessionId: SESSION, type: "view" }], { shops, events });
    expect(recorded).toBe(1);

    const summary = await readFunnel("kelp", { events });
    expect(summary!.views).toBe(1);
    expect(summary!.byVersion).toHaveLength(1);
    expect(summary!.byVersion[0]!.versionId).toBeTruthy();
  });

  it("drops an event for a shop that is not published", async () => {
    const { recorded, dropped } = await recordEvents([{ slug: "not-a-shop", sessionId: SESSION, type: "view" }], {
      shops,
      events,
    });
    expect(recorded).toBe(0);
    expect(dropped[0]).toContain("not-a-shop");
  });

  it("keeps a regeneration's events apart from the version before it", async () => {
    await recordEvents([{ slug: "kelp", sessionId: SESSION, type: "view" }], { shops, events });
    await publishShop({ config: CONFIG, ingest: INGEST, slug: "kelp" }, { store: shops });
    await recordEvents([{ slug: "kelp", sessionId: "bbbbbbbbbb123456", type: "view" }], { shops, events });

    const summary = await readFunnel("kelp", { events });
    // The reason publishing appends rather than overwrites: v1's numbers stay
    // v1's, so a regeneration can be judged against the version it replaced.
    expect(summary!.byVersion).toHaveLength(2);
    expect(summary!.views).toBe(2);
  });
});

describe("the numbers a merchant is owed", () => {
  const event = (over: Partial<FunnelEvent>): FunnelEvent => ({
    id: "e",
    shopId: "s",
    slug: "kelp",
    versionId: "v1",
    sessionId: "a",
    type: "view",
    createdAt: "2026-08-01T09:00:00.000Z",
    ...over,
  });

  it("rates per session, not per event", () => {
    // A shopper who taps four products converted once on the question the
    // merchant is asking. Counting it four times is how a funnel flatters
    // itself into a number nobody can act on.
    const summary = summarise(
      "kelp",
      [
        event({ sessionId: "a", type: "view" }),
        event({ sessionId: "b", type: "view" }),
        event({ sessionId: "a", type: "product_click", handle: "oat-crew" }),
        event({ sessionId: "a", type: "product_click", handle: "wool-throw" }),
        event({ sessionId: "a", type: "product_click", handle: "porto-mug" }),
      ],
      new Map(),
    );

    expect(summary.views).toBe(2);
    expect(summary.productClicks).toBe(3);
    expect(summary.clickRate).toBe(0.5);
  });

  it("splits by where the session came from", () => {
    const summary = summarise(
      "kelp",
      [
        event({ sessionId: "a", source: "instagram" }),
        event({ sessionId: "b", source: "instagram" }),
        event({ sessionId: "c", source: "tiktok", type: "checkout_start", handle: "oat-crew" }),
      ],
      new Map(),
    );

    expect(summary.bySource[0]).toEqual({ source: "instagram", sessions: 2, checkoutStarts: 0 });
    expect(summary.bySource[1]).toEqual({ source: "tiktok", sessions: 1, checkoutStarts: 1 });
  });

  it("returns zeroes rather than dividing by none", () => {
    const summary = summarise("kelp", [event({ type: "product_click", handle: "x" })], new Map());
    expect(Number.isFinite(summary.clickRate)).toBe(true);
    expect(summary.checkoutRate).toBe(0);
  });
});

describe("where a session came from", () => {
  it("recognises the platforms this product actually lives on", () => {
    expect(readSource({ referrer: "https://l.instagram.com/?u=x" })).toBe("instagram");
    expect(readSource({ referrer: "https://www.tiktok.com/@someone" })).toBe("tiktok");
    expect(readSource({ referrer: "https://t.co/abc" })).toBe("x");
    expect(readSource({ referrer: "https://www.google.com/search?q=x" })).toBe("search");
  });

  it("treats an absent referrer as direct, which is most in-app traffic", () => {
    expect(readSource({ referrer: null })).toBe("direct");
    expect(readSource({})).toBe("direct");
  });

  it("does not count a move inside the shop as a referral", () => {
    expect(readSource({ referrer: "https://popuup.com/kelp", selfOrigin: "https://popuup.com" })).toBe("direct");
  });

  it("lets the merchant's own tag beat the referrer", () => {
    // A utm_source is a statement of intent; a referrer is whatever the browser
    // felt like sending, and in-app browsers routinely send nothing at all.
    expect(readSource({ referrer: "https://www.google.com/", utmSource: "ig" })).toBe("instagram");
    expect(readSource({ utmSource: "linkinbio" })).toBe("instagram");
  });

  it("calls an unrecognised tag 'other' rather than 'direct'", () => {
    // The merchant meant something by it, even if we do not know what.
    expect(readSource({ utmSource: "print-flyer" })).toBe("other");
  });

  it("survives a referrer that is not a URL", () => {
    expect(readSource({ referrer: "android-app://com.example" })).toBe("other");
  });
});
