// What you get without paying, and where the wall is.
//
// The shape of this was decided by a rule the product already had, in
// plans.ts: *leaving never costs you your memories*. A family who stops
// paying keeps everything, readable and exportable, for ever — they simply
// cannot add to it until they come back.
//
// Read that as a statement about where a paywall may stand, and the free
// tier writes itself:
//
//   **The wall is on adding. Never on reading, exporting or deleting.**
//
// Everything else follows. A cap on memories rather than on days, because a
// clock punishes a family for pausing and this product is used in bursts —
// a hundred photographs one Sunday and nothing for three weeks is the normal
// pattern, not a lapse. A cap high enough that the free experience is the
// real one: past every threshold the noticing engine needs, so a parent who
// never pays a cent still gets the thing that makes this product worth
// having, which is the archive telling them something about their own family
// they had not noticed.
//
// ## There is no lapsed tier
//
// A family who paid for eight months and stopped falls back to free rather
// than into a third state of their own. That is one rule instead of two, and
// it removes an absurdity: under a separate lapsed tier, somebody who had
// paid us money would end up with less than somebody who never had. In
// practice a lapsed family is far past the cap and cannot add, which is
// exactly what plans.ts already promised — reached by consistency rather
// than by a special case.
//
// ## What the wall may never stand in front of
//
// NEVER_PAYWALLED is the important export in this file. Holding a family's
// own photographs, their export, their delete button, their activity log or
// their security settings behind a payment would contradict every other
// thing this product says, and it is exactly the sort of decision that gets
// made quietly under revenue pressure eighteen months from now. It is a test
// as well as a list.

import { ENOUGH_TO_NOTICE } from "@/lib/graph/first-look";
import { GB } from "@/lib/storage/allowance";

export type Tier = "free" | "paid";

/**
 * How many memories a family may keep without paying.
 *
 * A hundred. The number has to clear two bars at once.
 *
 * The lower bar is the wow: ENOUGH_TO_NOTICE is twelve, a first story is
 * twelve, and a weekday ritual needs five sightings over four months. A cap
 * near those would put the paywall exactly where the product first becomes
 * interesting, which is both cynical and bad business — nobody pays for a
 * thing they were stopped from seeing work.
 *
 * The upper bar is the year. A real year of a small child is several hundred
 * memories, so a hundred is unmistakably a beginning rather than a
 * substitute. A family who wants the year kept, and the book it produces,
 * is being asked to pay for the thing they actually came for.
 */
export const FREE_MEMORIES = 100;

/**
 * Room for those hundred, with space for a few videos among them.
 *
 * Two gigabytes. A hundred phone photographs is nearer three hundred
 * megabytes; the rest is so that the one clip of them singing is not the
 * thing that hits the wall.
 */
export const FREE_BYTES = 2 * GB;

/** Say something before it is a surprise, not after. */
export const TELL_THEM_AT = 0.8;

/**
 * What paying is for.
 *
 * Written as the positive list rather than as a list of locks, because that
 * is what it is: the book is the product, and the archive is how a year
 * becomes one. A page that enumerates what has been taken away reads as a
 * punishment for not having paid yet.
 */
export const WHAT_PAYING_ADDS = [
  "Room for a whole year, not the first hundred things",
  "The printed hardcover, and the digital edition of it",
  "The film of the year",
  "Family who can add their own — grandparents, the other parent",
  "A private email address to send things to as they happen",
];

/**
 * What a paywall may never stand in front of.
 *
 * Each of these is something a family already has rather than something we
 * are selling, and charging for it would be charging somebody to leave.
 * tests/free.test.ts holds the code to this list; it is not a statement of
 * intent.
 */
export const NEVER_PAYWALLED = [
  "reading everything you have kept",
  "downloading all of it, at original quality",
  "deleting all of it, permanently",
  "the activity log",
  "privacy and security settings",
  "naming somebody to inherit the archive",
  "revoking a link you have shared",
] as const;

export interface Standing {
  tier: Tier;
  kept: number;
  /** The cap, or null when there isn't one. */
  cap: number | null;
  /** 0–1 against the cap. Always 0 on a paid plan. */
  fraction: number;
  /** Worth mentioning. Nothing is blocked. */
  warn: boolean;
  /** No room for anything more until they pay. */
  full: boolean;
  /** How many more they may add, or null for no limit. */
  room: number | null;
}

/**
 * Whether a family is paying, from what the billing columns say.
 *
 * `past_due` counts as paying. A card that failed on Tuesday is a card
 * problem, and locking a parent out of their child's archive over one is a
 * way of turning a billing retry into a support incident and a cancellation.
 */
export function tierOf(input: {
  membershipState: string | null;
  paidUntil?: string | null;
  now?: string;
}): Tier {
  if (input.membershipState === "active" || input.membershipState === "past_due") return "paid";
  // A one-off purchase does not leave a membership behind, so the paid-until
  // date is what says this family has bought this year.
  if (input.paidUntil && Date.parse(input.paidUntil) > Date.parse(input.now ?? new Date().toISOString())) {
    return "paid";
  }
  return "free";
}

/** Where a family stands against the cap. */
export function standingFor(input: { tier: Tier; kept: number }): Standing {
  const kept = Math.max(0, input.kept);
  if (input.tier === "paid") {
    return { tier: "paid", kept, cap: null, fraction: 0, warn: false, full: false, room: null };
  }
  const fraction = kept / FREE_MEMORIES;
  return {
    tier: "free",
    kept,
    cap: FREE_MEMORIES,
    fraction,
    warn: fraction >= TELL_THEM_AT && kept < FREE_MEMORIES,
    full: kept >= FREE_MEMORIES,
    room: Math.max(0, FREE_MEMORIES - kept),
  };
}

export interface Verdict {
  ok: boolean;
  /** How many of this batch fit. */
  accepted: number;
  /** What to say, or null when there is nothing to say. */
  message: string | null;
}

/**
 * Whether a batch of new memories fits, and what to tell them.
 *
 * Partial acceptance on purpose. A parent dropping two hundred photographs
 * with ninety of their hundred left should end up with ninety more kept and
 * a clear sentence, not an error and an empty archive — the alternative
 * turns the best moment in the product into a failure. The same reasoning
 * as GRACE in the storage allowance, arrived at for the same reason.
 */
export function roomForMore(standing: Standing, incoming: number): Verdict {
  const wanted = Math.max(0, incoming);
  if (standing.cap === null) return { ok: true, accepted: wanted, message: null };

  const accepted = Math.min(wanted, standing.room ?? 0);

  if (accepted === 0) {
    return {
      ok: false,
      accepted: 0,
      message:
        `That's the first ${FREE_MEMORIES} kept — everything you've added is ` +
        `still here, and always will be. Keeping the rest of the year needs a ` +
        `membership.`,
    };
  }

  if (accepted < wanted) {
    return {
      ok: true,
      accepted,
      message:
        `${accepted} of those fit, and that's the first ${FREE_MEMORIES}. ` +
        `Nothing is lost — the rest are still on your phone, and a membership ` +
        `makes room for the year.`,
    };
  }

  const after = standing.kept + accepted;
  if (after >= FREE_MEMORIES * TELL_THEM_AT) {
    return {
      ok: true,
      accepted,
      message: `${FREE_MEMORIES - after} more before this year needs a membership.`,
    };
  }

  return { ok: true, accepted, message: null };
}

/** Sanity: the free cap must clear the point where the product gets good. */
export const CLEARS_THE_WOW = FREE_MEMORIES > ENOUGH_TO_NOTICE * 4;
