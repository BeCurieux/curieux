/**
 * The delivery envelope, and the two defences that keep a catalogue correct
 * when Shopify redelivers or delivers late.
 */

import { describe, expect, it } from "vitest";
import {
  deliveryAgeMs,
  readDelivery,
  subscribedTopic,
  SUBSCRIBED_TOPICS,
} from "@/lib/shopify/webhook";
import {
  ABANDONED_AFTER_MS,
  createMemoryDeliveryLog,
  shouldApplyProduct,
} from "@/lib/shopify/idempotency";

/** The documented header set, with the documented example formats. */
function headers(overrides: Record<string, string | undefined> = {}): Record<string, string> {
  const base: Record<string, string | undefined> = {
    "X-Shopify-Topic": "products/update",
    "X-Shopify-Shop-Domain": "kelp-and-cotton.myshopify.com",
    "X-Shopify-API-Version": "2026-07",
    "X-Shopify-Webhook-Id": "b54557e4-bdd9-4b37-8a5f-bf7d70bcd043",
    "X-Shopify-Event-Id": "7b8c9d0a-1234-5678-90ab-cdef12345678",
    "X-Shopify-Triggered-At": "2026-03-30T14:30:00.000000000Z",
    ...overrides,
  };
  return Object.fromEntries(
    Object.entries(base).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
}

describe("readDelivery", () => {
  it("reads the documented headers", () => {
    const result = readDelivery(headers());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.delivery.topic).toBe("products/update");
    expect(result.delivery.shopDomain).toBe("kelp-and-cotton.myshopify.com");
    expect(result.delivery.webhookId).toBe("b54557e4-bdd9-4b37-8a5f-bf7d70bcd043");
    expect(result.delivery.eventId).toBe("7b8c9d0a-1234-5678-90ab-cdef12345678");
    expect(result.delivery.apiVersion).toBe("2026-07");
    // Nanosecond precision, as the docs' own example shows it.
    expect(result.delivery.triggeredAt).toBe("2026-03-30T14:30:00.000000000Z");
  });

  it("reads them case-insensitively and under either prefix", () => {
    // "Treat header names as case-insensitive in your implementation" — and the
    // newer surfaces drop the `X-`. Betting on one spelling is how a delivery
    // arrives looking like it has no topic.
    const lower = readDelivery({
      "shopify-topic": "products/update",
      "shopify-shop-domain": "kelp-and-cotton.myshopify.com",
      "shopify-webhook-id": "abc123-def456",
      "shopify-api-version": "2026-07",
      "shopify-triggered-at": "2026-01-15T12:34:56Z",
      "shopify-event-id": "01ARZ3NDEKTSV4RRFFQ69G5FAV",
    });
    expect(lower.ok).toBe(true);
    if (lower.ok) expect(lower.delivery.topic).toBe("products/update");
  });

  it("reads a real Headers object", () => {
    const result = readDelivery(new Headers(headers()));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.delivery.webhookId).toBe("b54557e4-bdd9-4b37-8a5f-bf7d70bcd043");
  });

  it("refuses a delivery with no webhook id rather than inventing one", () => {
    // The idempotency key. A generated substitute would make every delivery
    // look new, which is the exact failure the ledger exists to prevent.
    const result = readDelivery(headers({ "X-Shopify-Webhook-Id": undefined }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/webhookId/);
  });

  it("refuses a shop domain that is not a myshopify domain", () => {
    // The shop domain selects the row every handler is about to write to.
    for (const domain of ["evil.example.com", "kelp.myshopify.com.evil.com", "", "../etc"]) {
      const result = readDelivery(headers({ "X-Shopify-Shop-Domain": domain }));
      expect(result.ok, domain).toBe(false);
    }
  });

  it("refuses a triggered-at that is not a timestamp", () => {
    const result = readDelivery(headers({ "X-Shopify-Triggered-At": "yesterday" }));
    expect(result.ok).toBe(false);
  });

  it("accepts a delivery with no event id", () => {
    // Optional in a way the webhook id is not: it correlates, it does not key.
    const result = readDelivery(headers({ "X-Shopify-Event-Id": undefined }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.delivery.eventId).toBeNull();
  });
});

describe("subscribedTopic", () => {
  it("routes only topics we asked for", () => {
    const delivery = readDelivery(headers());
    expect(delivery.ok).toBe(true);
    if (!delivery.ok) return;
    expect(subscribedTopic(delivery.delivery)).toBe("products/update");
  });

  it("returns null for a topic we do not handle, rather than guessing", () => {
    const delivery = readDelivery(headers({ "X-Shopify-Topic": "orders/paid" }));
    expect(delivery.ok).toBe(true);
    if (!delivery.ok) return;
    // An unknown topic is acknowledged and ignored. Routing it anywhere by
    // accident is how an app starts processing data it never asked for.
    expect(subscribedTopic(delivery.delivery)).toBeNull();
  });

  it("subscribes to the three mandatory compliance topics", () => {
    // Required for App Store distribution "regardless of whether the app
    // collects personal data". Ours collects none and must still answer.
    expect(SUBSCRIBED_TOPICS).toContain("customers/data_request");
    expect(SUBSCRIBED_TOPICS).toContain("customers/redact");
    expect(SUBSCRIBED_TOPICS).toContain("shop/redact");
  });

  it("subscribes to no topic that would need a scope beyond read_products", () => {
    // The scope minimisation, as a test. An orders or customers topic here
    // would mean requesting protected customer data, and would put an outcome
    // within reach of a merchandising decision — the drawer.
    const productOrApp = SUBSCRIBED_TOPICS.filter(
      (topic) =>
        !topic.startsWith("products/") &&
        !topic.startsWith("app/") &&
        !["customers/data_request", "customers/redact", "shop/redact"].includes(topic),
    );
    expect(productOrApp).toEqual([]);
  });
});

describe("deliveryAgeMs", () => {
  it("measures how long a delivery spent in flight", () => {
    const delivery = readDelivery(headers({ "X-Shopify-Triggered-At": "2026-03-30T14:30:00Z" }));
    expect(delivery.ok).toBe(true);
    if (!delivery.ok) return;
    const age = deliveryAgeMs(delivery.delivery, new Date("2026-03-30T18:30:00Z"));
    expect(age).toBe(4 * 60 * 60 * 1000);
  });

  it("parses the nanosecond-precision format the docs show", () => {
    const delivery = readDelivery(headers());
    expect(delivery.ok).toBe(true);
    if (!delivery.ok) return;
    const age = deliveryAgeMs(delivery.delivery, new Date("2026-03-30T14:30:01Z"));
    expect(age).not.toBeNull();
    expect(age).toBeGreaterThanOrEqual(0);
    expect(age).toBeLessThan(2000);
  });

  it("returns null rather than zero when nothing said when it was triggered", () => {
    const delivery = readDelivery(headers({ "X-Shopify-Triggered-At": undefined }));
    expect(delivery.ok).toBe(true);
    if (!delivery.ok) return;
    // Zero would read as "brand new", which is the opposite of what we know.
    expect(deliveryAgeMs(delivery.delivery, new Date())).toBeNull();
  });
});

describe("the delivery ledger", () => {
  const t0 = new Date("2026-03-30T14:30:00Z");
  const at = (ms: number) => new Date(t0.getTime() + ms);

  it("claims a delivery once", async () => {
    const log = createMemoryDeliveryLog();
    expect(await log.claim("wh-1", t0)).toEqual({ claimed: true });
  });

  it("skips a delivery that was already processed", async () => {
    // The documented reason this exists: "your app might receive the same
    // webhook more than once, for example after a network timeout or a retry."
    const log = createMemoryDeliveryLog();
    await log.claim("wh-1", t0);
    await log.settle("wh-1", "done", at(100));

    expect(await log.claim("wh-1", at(200))).toEqual({
      claimed: false,
      reason: "already-processed",
    });
  });

  it("refuses a second claim while the first is in flight", async () => {
    const log = createMemoryDeliveryLog();
    await log.claim("wh-1", t0);
    expect(await log.claim("wh-1", at(1000))).toEqual({ claimed: false, reason: "in-flight" });
  });

  it("reclaims a delivery whose handler died", async () => {
    // Without this, a process that dies between claiming and settling blocks
    // that delivery forever — and Shopify stops retrying after four hours, so
    // "forever" means the edit is lost.
    const log = createMemoryDeliveryLog();
    await log.claim("wh-1", t0);
    expect(await log.claim("wh-1", at(ABANDONED_AFTER_MS - 1))).toEqual({
      claimed: false,
      reason: "in-flight",
    });
    expect(await log.claim("wh-1", at(ABANDONED_AFTER_MS))).toEqual({ claimed: true });
  });

  it("lets a failed delivery be retried immediately", async () => {
    const log = createMemoryDeliveryLog();
    await log.claim("wh-1", t0);
    await log.settle("wh-1", "failed", at(10));
    // Shopify is going to resend it; making the resend a no-op would waste the
    // retry we actually want.
    expect(await log.claim("wh-1", at(20))).toEqual({ claimed: true });
  });

  it("treats two deliveries of one event as two deliveries", async () => {
    // "If you have more than one subscription for the same topic, you'll
    // receive a separate delivery per subscription. Each has a different
    // X-Shopify-Webhook-Id but shares the same X-Shopify-Event-Id."
    //
    // Keying the ledger on the event id would silently drop the second.
    const log = createMemoryDeliveryLog();
    expect(await log.claim("wh-1", t0)).toEqual({ claimed: true });
    expect(await log.claim("wh-2", t0)).toEqual({ claimed: true });
    expect(log.size()).toBe(2);
  });
});

describe("out-of-order defence", () => {
  const held = { handle: "kelp-crew", updatedAt: "2026-03-30T12:00:00Z" };

  it("applies a newer product state", () => {
    expect(
      shouldApplyProduct({ handle: "kelp-crew", updatedAt: "2026-03-30T13:00:00Z" }, held),
    ).toEqual({ apply: true });
  });

  it("drops a state older than what we hold", () => {
    // The failure this exists for: a retry replays "the original payload from
    // the time they were triggered", up to eight times over four hours. So an
    // older product state genuinely can land after a newer one, and applying it
    // would undo a real edit — a price reverting on its own, days later.
    expect(
      shouldApplyProduct({ handle: "kelp-crew", updatedAt: "2026-03-30T11:00:00Z" }, held),
    ).toEqual({ apply: false, reason: "stale" });
  });

  it("drops an exact redelivery", () => {
    expect(shouldApplyProduct({ handle: "kelp-crew", updatedAt: held.updatedAt }, held)).toEqual({
      apply: false,
      reason: "stale",
    });
  });

  it("applies anything for a product we have never seen", () => {
    expect(shouldApplyProduct({ handle: "new-thing", updatedAt: null }, null)).toEqual({
      apply: true,
    });
  });

  it("applies rather than drops when a timestamp is missing or unreadable", () => {
    // The same asymmetry as `availabilityKnown` in the ingester: not knowing is
    // recorded as not knowing, never as a negative. Refusing an edit we cannot
    // date would lose real changes; applying one costs at worst a redundant
    // write of the full current state.
    expect(shouldApplyProduct({ handle: "kelp-crew", updatedAt: null }, held)).toEqual({
      apply: true,
    });
    expect(
      shouldApplyProduct({ handle: "kelp-crew", updatedAt: "not a date" }, held),
    ).toEqual({ apply: true });
    expect(
      shouldApplyProduct(
        { handle: "kelp-crew", updatedAt: "2026-03-30T13:00:00Z" },
        { handle: "kelp-crew", updatedAt: null },
      ),
    ).toEqual({ apply: true });
  });

  it("compares the resource's clock, not the delivery's", () => {
    // Two edits to one product are ordered by their own updatedAt, whatever
    // order the transport chose. This is why the watermark is per-handle and
    // reads the payload rather than X-Shopify-Triggered-At.
    const first = { handle: "kelp-crew", updatedAt: "2026-03-30T12:00:00Z" };
    const second = { handle: "kelp-crew", updatedAt: "2026-03-30T12:00:01Z" };

    // Arriving in the wrong order: the newer one lands first.
    expect(shouldApplyProduct(second, first)).toEqual({ apply: true });
    expect(shouldApplyProduct(first, second)).toEqual({ apply: false, reason: "stale" });
  });
});
