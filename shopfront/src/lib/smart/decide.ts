/**
 * What to do about drift — hold, mend, or make it again.
 *
 * Three outcomes, and the reason there are three rather than two is cost.
 * Regenerating means a model call and a new version, which is right when the
 * page no longer makes sense and wasteful when one product of nine sold out.
 * Mending is free, instant and reversible, and it is the honest answer to most
 * of what actually happens to a catalogue.
 *
 * The thresholds are constants in this file, with the reasoning next to them.
 * They are guesses — good ones, but guesses — and the point of putting them
 * here in the open is that somebody who watches thirty shops drift for a month
 * can argue with them. That is the difference between a rule and a weight: a
 * rule is a decision somebody made and can be talked out of.
 *
 * Nothing here has any idea what a shopper did, and it must stay that way. A
 * rule that read the funnel would be indistinguishable from this in shape and
 * would be the drawer standing open.
 */

import type { CatalogueDrift } from "./drift";
import type { RefreshPolicy } from "@/lib/publish/types";

export type RefreshAction = "hold" | "repair" | "regenerate";

export interface RefreshDecision {
  action: RefreshAction;
  /** Why, in a sentence a person can read in a CLI. */
  reason: string;
}

/**
 * Above this share of damage, mending stops being mending.
 *
 * A third is the point where a repaired page stops resembling the page that was
 * merchandised: reorder and drop enough cards and what is left is an arbitrary
 * subset of somebody's selection, which is worse than either the stale version
 * or an honest new one. Below it, the shape survives the surgery.
 */
export const REGENERATE_ABOVE = 1 / 3;

/**
 * A block cannot go below this many products without being regenerated.
 *
 * `ProductGridBlock` requires at least one, so a repair that empties a grid
 * produces a config the schema rejects — the repair would fail validation and
 * we would find out by exception rather than by decision. Two, because a grid
 * of one is not a grid, and a merchant looking at it would ask why.
 */
export const MIN_PRODUCTS_PER_BLOCK = 2;

export interface DecideInput {
  drift: CatalogueDrift;
  policy: RefreshPolicy;
  /** Smallest surviving block after repair. From `repair.ts`'s dry run. */
  smallestBlockAfterRepair: number;
}

export function decide({ drift, policy, smallestBlockAfterRepair }: DecideInput): RefreshDecision {
  if (policy === "pinned") {
    return { action: "hold", reason: "This shop is pinned. Its selection is the merchant's until they change it." };
  }

  if (drift.gone.length === 0 && drift.soldOut.length === 0) {
    return { action: "hold", reason: "Every product on the page is still listed and still in stock." };
  }

  if (drift.damage > REGENERATE_ABOVE) {
    return {
      action: "regenerate",
      reason: `${percent(drift.damage)} of the page is sold out or delisted — past what mending can carry.`,
    };
  }

  if (smallestBlockAfterRepair < MIN_PRODUCTS_PER_BLOCK) {
    return {
      action: "regenerate",
      reason: "Mending would leave a block with too little in it to be a block.",
    };
  }

  return {
    action: "repair",
    reason: describeRepair(drift),
  };
}

function describeRepair(drift: CatalogueDrift): string {
  const parts: string[] = [];
  if (drift.gone.length > 0) parts.push(`${count(drift.gone.length, "product")} delisted`);
  if (drift.soldOut.length > 0) parts.push(`${count(drift.soldOut.length, "product")} sold out`);
  return `${parts.join(", ")} — mendable without regenerating.`;
}

function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
