/**
 * Two different defences that are easy to confuse.
 *
 * **Duplicates** are the same delivery arriving twice — a retry after a network
 * timeout, or a response Shopify never saw. Suppressed by `webhookId`.
 *
 * **Out-of-order** is two *different* deliveries arriving in the wrong sequence,
 * so an older product state lands after a newer one and undoes it. Suppressed
 * by comparing the resource's own `updatedAt` against what we already hold.
 *
 * A ledger of delivery ids does nothing about the second, and a timestamp
 * watermark does nothing about the first. Both are needed, and the second is
 * the one that quietly corrupts a catalogue.
 *
 * Neither is the primary defence. The primary defence is that applying a
 * `products/update` is a replace-by-handle of the product's full current state,
 * so applying it twice is applying it once. These exist to stop wasted work and
 * to stop a stale replay winning, not to make a non-idempotent operation safe.
 *
 * Storage is an interface because production is Postgres and every test here is
 * a map. Nothing above this file knows which it has.
 */

export type DeliveryStatus = "processing" | "done" | "failed";

export interface DeliveryRecord {
  webhookId: string;
  status: DeliveryStatus;
  startedAt: Date;
}

export interface DeliveryLog {
  /**
   * Claim this delivery, or report who already has it.
   *
   * One call rather than get-then-set: two concurrent deliveries with the same
   * id must not both be told they are first, and a check followed by a write is
   * exactly the race that allows it. In Postgres this is an
   * `insert … on conflict do nothing returning`.
   */
  claim(webhookId: string, now: Date): Promise<ClaimResult>;
  settle(webhookId: string, status: "done" | "failed", now: Date): Promise<void>;
}

export type ClaimResult =
  | { claimed: true }
  /** Somebody finished it. Acknowledge and do nothing. */
  | { claimed: false; reason: "already-processed" }
  /** Somebody is mid-flight. Acknowledge; they will finish or time out. */
  | { claimed: false; reason: "in-flight" };

/**
 * How long a `processing` row may sit before it is treated as abandoned.
 *
 * A handler that dies between claiming and settling would otherwise block that
 * delivery forever, and Shopify stops retrying after four hours — so "forever"
 * means the edit is simply lost. The window has to exceed the longest a real
 * handler can take (Shopify's own request timeout is five seconds, but the work
 * happens off the response) and stay well inside the retry window.
 */
export const ABANDONED_AFTER_MS = 5 * 60_000;

export function createMemoryDeliveryLog(): DeliveryLog & { size(): number } {
  const rows = new Map<string, DeliveryRecord>();

  return {
    async claim(webhookId, now) {
      const existing = rows.get(webhookId);

      if (existing) {
        if (existing.status === "done") return { claimed: false, reason: "already-processed" };

        const age = now.getTime() - existing.startedAt.getTime();
        // A failed row is retryable immediately: Shopify is going to resend it
        // and there is no reason to make the resend a no-op.
        const abandoned = existing.status === "processing" && age >= ABANDONED_AFTER_MS;
        if (existing.status === "processing" && !abandoned) {
          return { claimed: false, reason: "in-flight" };
        }
      }

      rows.set(webhookId, { webhookId, status: "processing", startedAt: now });
      return { claimed: true };
    },

    async settle(webhookId, status, now) {
      const existing = rows.get(webhookId);
      rows.set(webhookId, { webhookId, status, startedAt: existing?.startedAt ?? now });
    },

    size: () => rows.size,
  };
}

// ---------------------------------------------------------------- ordering

/**
 * What we already hold for a product, as far as ordering is concerned.
 *
 * `updatedAt` is the product's own timestamp from the payload — a fact about
 * the resource. Deliberately not the delivery's `triggeredAt`, which is a fact
 * about the transport: two edits to one product produce two payloads whose
 * `updatedAt` order is the truth, whatever order they were sent or arrived in.
 */
export interface HeldProduct {
  handle: string;
  updatedAt: string | null;
}

export type OrderingVerdict =
  | { apply: true }
  | { apply: false; reason: "stale" };

/**
 * Should this product payload be applied over what we hold?
 *
 * The rules, in order:
 *
 * - Nothing held yet: apply. A create, or a product we have never seen.
 * - Incoming has no timestamp: apply. We cannot prove it is stale, and refusing
 *   an edit we cannot date would lose real changes on any surface that omits
 *   the field. The asymmetry is deliberate and matches `availabilityKnown` in
 *   the ingester: not knowing is recorded as not knowing, never as a negative.
 * - Held has no timestamp: apply. Anything dated beats something undated.
 * - Otherwise: apply only if the incoming timestamp is strictly newer.
 *
 * Equal timestamps do not apply. A same-millisecond redelivery is a duplicate,
 * and the ledger above should have caught it; applying it again is at best
 * wasted work and at worst a second write of an identical blob that bumps a
 * version counter other things are watching.
 */
export function shouldApplyProduct(
  incoming: { handle: string; updatedAt: string | null },
  held: HeldProduct | null | undefined,
): OrderingVerdict {
  if (!held) return { apply: true };
  if (!incoming.updatedAt) return { apply: true };
  if (!held.updatedAt) return { apply: true };

  const a = Date.parse(incoming.updatedAt);
  const b = Date.parse(held.updatedAt);
  // An unparseable timestamp is the same as an absent one: we cannot prove
  // staleness, so we do not claim it.
  if (!Number.isFinite(a) || !Number.isFinite(b)) return { apply: true };

  return a > b ? { apply: true } : { apply: false, reason: "stale" };
}
