/**
 * The funnel: view → product click → checkout start.
 *
 * Step 6, and the answer to the first question every merchant asks — "is this
 * actually better than sending everyone to my store?" The brief is blunt that
 * page views alone are unacceptable, because the product's claim is that it
 * sells things.
 *
 * Three things this deliberately is not.
 *
 * It is **not analytics**. Three event types, closed. No custom events, no
 * properties bag, no funnel builder. Every one of those is how an events table
 * becomes a product nobody asked for.
 *
 * It is **not the drawer**. CLAUDE.md keeps PULSE shut until the logs contain
 * enough real sessions to learn from, so nothing here carries a weight, a
 * variant assignment or a score. This records what happened. Reading anything
 * back into a decision is a different step and is not this one.
 *
 * It is **not tracking**. No cookie, no IP address, no fingerprint, no
 * cross-site anything. A session id lives in `sessionStorage`, is scoped to one
 * tab on one origin, and dies with it. The one contextual thing recorded is
 * where the click came from — which is the layer the brief calls the honest
 * moat, and it is read from the referrer the browser already sent.
 */

export const EVENT_TYPES = ["view", "product_click", "checkout_start"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/**
 * Where a session arrived from.
 *
 * Deliberately coarse. "instagram" is the useful fact — it tells a merchant
 * which bio is working — and the full referring URL is not needed to know it.
 * Recording less than the browser offered is the whole point.
 */
export const TRAFFIC_SOURCES = [
  "instagram",
  "tiktok",
  "facebook",
  "youtube",
  "pinterest",
  "x",
  "linkedin",
  "snapchat",
  "reddit",
  "threads",
  "whatsapp",
  "email",
  "search",
  "direct",
  "other",
] as const;
export type TrafficSource = (typeof TRAFFIC_SOURCES)[number];

/** What the browser sends. Anything richer than this is not collected. */
export interface FunnelEventInput {
  slug: string;
  /** The version that served this page. Sent by the server, not the client. */
  versionId: string;
  sessionId: string;
  type: EventType;
  /** Present on product_click and checkout_start. */
  handle?: string;
  /** Present on checkout_start, when a permalink was built. */
  variantId?: string;
  source?: TrafficSource;
  /** The `utm_campaign` on the shop URL, if the merchant used one. */
  campaign?: string;
}

export interface FunnelEvent extends FunnelEventInput {
  id: string;
  shopId: string;
  createdAt: string;
}

/**
 * The numbers a merchant is owed.
 *
 * Rates as well as counts, because "1,200 views" answers nothing on its own and
 * "8% of people who saw this clicked a product" is the comparison they are
 * actually making against their own storefront.
 */
export interface FunnelSummary {
  slug: string;
  views: number;
  productClicks: number;
  checkoutStarts: number;
  /** Distinct sessions, not events. */
  sessions: number;
  clickRate: number;
  checkoutRate: number;
  bySource: { source: TrafficSource; sessions: number; checkoutStarts: number }[];
  byProduct: { handle: string; clicks: number; checkoutStarts: number }[];
  /** Per shop version, so a regeneration can be judged against the last one. */
  byVersion: { versionId: string; version: number; views: number; checkoutStarts: number }[];
}
