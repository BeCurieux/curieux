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
  /** The merchant's storefront, as given to the ingester. */
  storeUrl: string;
  /** Filled in once a shop has been generated for them. */
  slug?: string;
  shopUrl?: string;
  /** Why this merchant is on the list — former Linkpop user, active bio link. */
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
  /** One sentence, in the brief's own terms. */
  reason: string;
}
