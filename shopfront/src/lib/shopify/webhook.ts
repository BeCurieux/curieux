/**
 * The webhook delivery envelope.
 *
 * Headers in, a validated `WebhookDelivery` out — or a refusal saying which
 * header was wrong. Nothing here parses the payload: the envelope is what
 * decides whether the payload is worth looking at, and mixing the two means a
 * malformed body can stop a well-formed delivery being acknowledged.
 *
 * Header names verified against shopify.dev's documented set (SHOPIFY-APP.md
 * §10). The docs also say, of the newer `Shopify-`-prefixed spelling: "Treat
 * header names as case-insensitive in your implementation." So this reads them
 * case-insensitively and accepts both prefixes rather than betting on one.
 */

import { z } from "zod";

/**
 * The topics this app subscribes to. A closed set on purpose.
 *
 * An unknown topic is not an error — Shopify may deliver something we once
 * subscribed to and have since forgotten — but it must never be routed to a
 * handler by accident, so it parses to `null` and the route acknowledges it
 * without acting. See `SUBSCRIBED_TOPICS` for what we actually ask for.
 */
export const SUBSCRIBED_TOPICS = [
  "products/create",
  "products/update",
  "products/delete",
  "app/uninstalled",
  "app/scopes_update",
  "customers/data_request",
  "customers/redact",
  "shop/redact",
] as const;

export type SubscribedTopic = (typeof SUBSCRIBED_TOPICS)[number];

/**
 * A myshopify domain, and nothing else.
 *
 * Validated rather than trusted, because the shop domain is the key every
 * handler uses to find the row it is about to write to. A delivery that
 * survived HMAC cannot be forged, but this also runs on replayed and
 * hand-constructed input during development, and "which store does this write
 * to" is not a question to answer from an unvalidated string.
 */
export const ShopDomain = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/, "not a myshopify.com domain");

export const WebhookDelivery = z.object({
  /** `X-Shopify-Webhook-Id`. Unique per delivery. The idempotency key. */
  webhookId: z.string().min(1),
  /**
   * `X-Shopify-Event-Id`. Shared by every delivery from one merchant action.
   *
   * Not the idempotency key: two subscriptions on one topic produce two
   * deliveries with different webhook ids and the same event id, and keying on
   * this would silently drop the second one.
   */
  eventId: z.string().min(1).nullable(),
  topic: z.string().min(1),
  shopDomain: ShopDomain,
  apiVersion: z.string().min(1).nullable(),
  /** `X-Shopify-Triggered-At`. When Shopify fired it, not when we got it. */
  triggeredAt: z.string().datetime({ offset: true }).nullable(),
});
export type WebhookDelivery = z.infer<typeof WebhookDelivery>;

export type HeaderSource = Headers | Record<string, string | string[] | undefined>;

function header(source: HeaderSource, name: string): string | null {
  const wanted = name.toLowerCase();
  if (source instanceof Headers) return source.get(wanted);

  for (const [key, value] of Object.entries(source)) {
    if (key.toLowerCase() !== wanted) continue;
    const first = Array.isArray(value) ? value[0] : value;
    return first ?? null;
  }
  return null;
}

/** Either spelling, either case. The `X-` prefix is the older of the two. */
function shopifyHeader(source: HeaderSource, suffix: string): string | null {
  return header(source, `x-shopify-${suffix}`) ?? header(source, `shopify-${suffix}`);
}

export type DeliveryParse =
  | { ok: true; delivery: WebhookDelivery }
  | { ok: false; reason: string };

/**
 * Headers -> a delivery, or a reason it is not one.
 *
 * Deliberately not throwing: the route needs to distinguish "this is not a
 * Shopify delivery" (400) from "this is one and we could not verify it" (401)
 * from "this is one and we cannot process it" (500), and an exception collapses
 * all three.
 */
export function readDelivery(source: HeaderSource): DeliveryParse {
  const raw = {
    webhookId: shopifyHeader(source, "webhook-id"),
    eventId: shopifyHeader(source, "event-id"),
    topic: shopifyHeader(source, "topic"),
    shopDomain: shopifyHeader(source, "shop-domain"),
    apiVersion: shopifyHeader(source, "api-version"),
    triggeredAt: shopifyHeader(source, "triggered-at"),
  };

  const parsed = WebhookDelivery.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first?.path.join(".") ?? "delivery";
    return { ok: false, reason: `${path}: ${first?.message ?? "invalid"}` };
  }
  return { ok: true, delivery: parsed.data };
}

/** The subscribed topic this delivery is for, or null if we do not handle it. */
export function subscribedTopic(delivery: WebhookDelivery): SubscribedTopic | null {
  const found = SUBSCRIBED_TOPICS.find((topic) => topic === delivery.topic);
  return found ?? null;
}

/**
 * How long this delivery spent in flight, in milliseconds. Null when it did not
 * say when it was triggered.
 *
 * Shopify replays the *original* payload on retry, up to eight times over four
 * hours, and the docs warn that deliveries can arrive up to a day late. So age
 * is a real signal — but it is a signal for logging and for alarm, never for
 * discarding. A four-hour-old delivery may still be the newest state we have
 * seen for that product, and dropping it on age alone would lose an edit.
 * Discarding is `idempotency.ts`'s job and it compares resource timestamps,
 * which is the fact that actually decides the question.
 */
export function deliveryAgeMs(delivery: WebhookDelivery, now: Date): number | null {
  if (!delivery.triggeredAt) return null;
  const triggered = Date.parse(delivery.triggeredAt);
  if (!Number.isFinite(triggered)) return null;
  return now.getTime() - triggered;
}
