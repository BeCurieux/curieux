/**
 * Shop refresh: read the drift, decide, mend if mending is enough.
 *
 * The whole of "Smart Shops" that can honestly be built today. A shop marked
 * `live` re-reads the catalogue it sits on and repairs its own selection —
 * delisted products leave, sold-out ones move behind the buyable ones — and
 * says so when the damage is past mending and a person should regenerate it.
 *
 * The half that is not here, deliberately: nothing self-tunes. A shop does not
 * learn that a product converts and promote it, because that is PULSE, the
 * drawer is shut, and opening it needs asking. What this does is arithmetic
 * over stock, which is a fact, computed the same way every time, and auditable
 * by reading three short files.
 */

import { readDrift } from "./drift";
import { decide } from "./decide";
import { repair } from "./repair";
import type { CatalogueDrift } from "./drift";
import type { RefreshDecision } from "./decide";
import type { Catalogue } from "@/lib/ingest/types";
import type { RefreshPolicy } from "@/lib/publish/types";
import type { ShopConfig } from "@/lib/schema";

export interface RefreshInput {
  config: ShopConfig;
  /** The catalogue as it is now, not the one the shop was built from. */
  catalogue: Catalogue;
  policy: RefreshPolicy;
}

export interface RefreshOutcome {
  drift: CatalogueDrift;
  decision: RefreshDecision;
  /** The mended config, present only when the decision was `repair`. */
  config: ShopConfig | null;
  dropped: string[];
  demoted: string[];
}

export function refreshShop({ config, catalogue, policy }: RefreshInput): RefreshOutcome {
  const drift = readDrift(config, catalogue);

  // The repair runs before the decision because the decision needs to know what
  // mending would cost — specifically whether it would leave a block too thin
  // to be one. Cheap enough to do speculatively; discarded unless it is chosen.
  const mended = repair(config, catalogue, drift);
  const decision = decide({ drift, policy, smallestBlockAfterRepair: mended.smallestBlock });

  if (decision.action !== "repair") {
    return { drift, decision, config: null, dropped: [], demoted: [] };
  }

  /*
   * A mend that changes nothing is not a mend.
   *
   * Drift persists after it has been dealt with — three products stay sold out
   * long after the page stopped leading with them — so `decide` goes on saying
   * "repair" every time it is asked. Without this, `pnpm refresh --all --apply`
   * on a schedule appends an identical version on every run: a version history
   * of nothing, and funnel attribution split across versions that differ by
   * their timestamp alone.
   *
   * Compared by value rather than by the dropped/demoted lists, because those
   * describe what the rules did and this asks the only question that matters —
   * whether what gets served is different.
   */
  if (JSON.stringify(mended.config) === JSON.stringify(config)) {
    return {
      drift,
      decision: { action: "hold", reason: "The page already reflects what has sold out. Nothing left to mend." },
      config: null,
      dropped: [],
      demoted: [],
    };
  }

  return {
    drift,
    decision,
    config: mended.config,
    dropped: mended.dropped,
    demoted: mended.demoted,
  };
}

export { readDrift, referencedProducts } from "./drift";
export { decide, REGENERATE_ABOVE, MIN_PRODUCTS_PER_BLOCK } from "./decide";
export { repair } from "./repair";
export type { CatalogueDrift, ProductDrift } from "./drift";
export type { RefreshAction, RefreshDecision } from "./decide";
export type { RepairResult } from "./repair";
