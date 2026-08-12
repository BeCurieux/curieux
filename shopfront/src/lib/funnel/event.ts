/**
 * The wire format.
 *
 * This is the one endpoint in the system that accepts input from anybody with
 * the URL, so the schema is the security boundary as much as the shape. Every
 * field is bounded, the enums are closed, and `.strict()` means an unexpected
 * key is a rejection rather than a column somebody discovers later.
 *
 * What a client is *not* allowed to send matters more than what it is. It
 * cannot name a shop id, a version number or a timestamp: the server resolves
 * the slug to the version it is currently serving and stamps the clock itself.
 * Otherwise the funnel is a table anyone can write anything into.
 */

import { z } from "zod";
import { EVENT_TYPES, TRAFFIC_SOURCES } from "./types";

/** Long enough to not collide, short enough to be obviously not a fingerprint. */
const SESSION_ID = /^[a-z0-9]{16,32}$/;

export const FunnelEventBody = z
  .object({
    slug: z.string().min(1).max(64),
    sessionId: z.string().regex(SESSION_ID),
    type: z.enum(EVENT_TYPES),
    handle: z.string().max(200).optional(),
    variantId: z.string().max(40).optional(),
    source: z.enum(TRAFFIC_SOURCES).optional(),
    campaign: z.string().max(120).optional(),
  })
  .strict();

export type FunnelEventBody = z.infer<typeof FunnelEventBody>;

/** A handful of events, so one navigation is one request. */
export const FunnelEventBatch = z.object({ events: z.array(FunnelEventBody).min(1).max(20) }).strict();

export type FunnelEventBatch = z.infer<typeof FunnelEventBatch>;

/**
 * A session id, generated in the browser and never derived from anything.
 *
 * Random, not a hash of anything about the person: a fingerprint that looked
 * like this would be indistinguishable at rest, and the difference has to be
 * visible in the code that makes it. It lives in `sessionStorage`, so it is
 * scoped to one tab on one origin and dies when that tab closes — no cookie,
 * nothing that survives to be joined against anything else.
 */
export function newSessionId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 24);
}
