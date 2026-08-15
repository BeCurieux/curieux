/**
 * Step 7 is "Stop", and this is the only thing it asks anyone to build.
 *
 * The build order's seventh entry is not a feature. It is a gate: OAuth sync,
 * email capture, creator shops, billing, word-editing and TikTok-URL input are
 * Sprint 3, and they stay unbuilt until thirty real merchants have been asked
 * and five of them actively want their shop live.
 *
 * A threshold nobody writes down is a threshold that gets argued with. The
 * brief says so in as many words — "Kill quickly rather than rationalise" — and
 * the whole point of a two-week, near-zero-cost test is that a no is cheap now
 * and expensive after four weeks of OAuth plumbing. So the count is recorded as
 * it happens and the verdict is computed rather than reached.
 *
 * This is deliberately not part of the product. It is our own record about
 * merchants who have agreed to nothing, so it lives in a local file, never in
 * the shops database, and it is not reachable from any route.
 */

/**
 * The outreach funnel from the brief: opened → replied → asked to connect →
 * published → asked price / paid.
 *
 * Ordered, and the order is load-bearing: a merchant who paid necessarily
 * wanted it live, so counting the threshold means counting everyone at or past
 * `wants_it_live` rather than everyone sitting exactly on it.
 */
export const STAGES = ["sent", "opened", "replied", "wants_it_live", "asked_price", "paid"] as const;
export type Stage = (typeof STAGES)[number];

/**
 * Who was asked.
 *
 * The brief's gate counts merchants, and it still does — see `verdict`. This
 * exists because the more interesting question during the test is not only
 * "does anyone want this" but "who". A creator with an audience and no
 * storefront of their own is a different buyer from a merchant with four
 * hundred products, and the two answers should never be added together and
 * read as one.
 *
 * A creator here still means somebody who sells something with a public
 * product feed — merch, digital goods, a small line. There is nothing to
 * ingest for a creator who only posts affiliate links, and the shop that
 * produces would be a demo of the wrong thing.
 */
export const SEGMENTS = ["merchant", "creator"] as const;
export type Segment = (typeof SEGMENTS)[number];

/** How a conversation ended, when it ended. */
export const OUTCOMES = ["open", "declined", "silent"] as const;
export type Outcome = (typeof OUTCOMES)[number];

/**
 * The stage that counts.
 *
 * "Proceed: 5+ of 30 actively wanting it live." Wanting it live is asking to
 * connect — a reply saying "nice" is not it, and the distinction is the entire
 * value of the test. Naming the constant here means moving the goalposts is a
 * commit somebody has to justify rather than a judgement call in the moment.
 */
export const THRESHOLD_STAGE: Stage = "wants_it_live";
export const THRESHOLD_COUNT = 5;
export const TARGET_MERCHANTS = 30;

export interface Target {
  /** The storefront, as given to the ingester. */
  storeUrl: string;
  /**
   * Optional because ledgers written before segments existed do not have it,
   * and a run in progress must not be invalidated by a schema change. Read it
   * through `segmentOf`, which is where the default lives.
   */
  segment?: Segment;
  /** Filled in once a shop has been generated for them. */
  slug?: string;
  shopUrl?: string;
  /** Why this one is on the list — former Linkpop user, active bio link. */
  note?: string;
  stage: Stage;
  outcome: Outcome;
  /** Free text. The reason a no was a no is the most useful thing here. */
  said?: string;
  generatedAt?: string;
  updatedAt: string;
}

export interface Ledger {
  version: 1;
  startedAt: string;
  targets: Target[];
}

/** What one segment did, counted on its own. */
export interface SegmentTally {
  contacted: number;
  wantItLive: number;
}

export type VerdictCall = "proceed" | "kill" | "running";

export interface Verdict {
  call: VerdictCall;
  /** Merchants at or past the threshold stage. */
  wantItLive: number;
  /** Unprompted "how much?" — the brief calls this gold. */
  askedPrice: number;
  paid: number;
  generated: number;
  contacted: number;
  resolved: number;
  outstanding: number;
  /**
   * Every segment, counted separately — including the merchants the gate is
   * computed from, so the two numbers can be compared without recomputing one
   * of them.
   */
  segments: Record<Segment, SegmentTally>;
  /** One sentence, in the brief's own terms. */
  reason: string;
}
