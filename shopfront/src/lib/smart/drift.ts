/**
 * What has moved under a shop since it was merchandised.
 *
 * A published shop pins a selection: these products, in this order, with this
 * copy. The catalogue underneath it does not hold still — things sell out,
 * things are delisted, new things arrive, prices change. Prices and stock
 * already flow through, because the renderer resolves them from the store's
 * catalogue rather than from the config. What does not flow through is the
 * *selection*, and that is what goes stale.
 *
 * This file only measures. It makes no decision and changes nothing: given the
 * config and the catalogue as it is now, it says what is different. `decide.ts`
 * turns that into an action and `repair.ts` carries it out, and keeping the
 * three apart is what makes the rules arguable — a threshold you can read is a
 * threshold somebody can disagree with.
 *
 * It is a pure comparison of two catalogues' worth of facts. No history, no
 * sessions, no counts of anything a shopper did. That boundary is the drawer
 * rule and it is enforced in `tests/stop-line.test.tsx`, not just meant here.
 */

import type { Catalogue, IngestedProduct } from "@/lib/ingest/types";
import type { ShopConfig } from "@/lib/schema";

/** One product the shop refers to, and what became of it. */
export interface ProductDrift {
  handle: string;
  /** Which block it sits in, so a repair knows where to reach. */
  blockId: string;
  state: "ok" | "sold-out" | "gone";
}

export interface CatalogueDrift {
  /** Every handle the config references, in page order. */
  referenced: ProductDrift[];
  /** Referenced, still listed, and now unavailable. */
  soldOut: ProductDrift[];
  /** Referenced and no longer in the catalogue at all. */
  gone: ProductDrift[];
  /**
   * Available products the shop has never shown.
   *
   * Not "new arrivals" — this has no reliable sense of when something was
   * added, and a `published_at` from a feed is the date a product was created,
   * not the date it started being worth showing. "Not on this page" is the fact
   * that is actually true, and it is the one a regeneration would act on.
   */
  unused: IngestedProduct[];
  /** How much of the page is broken, 0–1. The number `decide.ts` thresholds. */
  damage: number;
}

/** Every product reference in the config, in page order, with its block. */
export function referencedProducts(config: ShopConfig): { handle: string; blockId: string }[] {
  const refs: { handle: string; blockId: string }[] = [];

  for (const { id, block } of config.blocks) {
    switch (block.type) {
      case "hero":
        if (block.media?.kind === "productImage") refs.push({ handle: block.media.handle, blockId: id });
        break;
      case "productGrid":
      case "drop":
        for (const product of block.products) refs.push({ handle: product.handle, blockId: id });
        break;
      case "routine":
        for (const step of block.steps) refs.push({ handle: step.product.handle, blockId: id });
        break;
      default:
        break;
    }
  }

  return refs;
}

export function readDrift(config: ShopConfig, catalogue: Catalogue): CatalogueDrift {
  const byHandle = new Map(catalogue.products.map((product) => [product.handle, product]));

  const referenced: ProductDrift[] = referencedProducts(config).map(({ handle, blockId }) => {
    const product = byHandle.get(handle);
    const state: ProductDrift["state"] = !product ? "gone" : product.available ? "ok" : "sold-out";
    return { handle, blockId, state };
  });

  const shown = new Set(referenced.map((entry) => entry.handle));
  const soldOut = referenced.filter((entry) => entry.state === "sold-out");
  const gone = referenced.filter((entry) => entry.state === "gone");

  /*
   * Damage weights a vanished product heavier than a sold-out one, because
   * they fail differently. A sold-out product still belongs on the page — the
   * brief is explicit that sold-out is shown and marked, never hidden, and a
   * shopper seeing what they missed is information. A product that has left
   * the catalogue is a card the renderer cannot fill at all.
   *
   * Halves and wholes rather than tuned coefficients, and written here in the
   * open. This is arithmetic over stock, which is why it is allowed to exist;
   * anything that needed fitting would be the engine we do not have.
   */
  const damage = referenced.length === 0 ? 0 : (gone.length + soldOut.length * 0.5) / referenced.length;

  return {
    referenced,
    soldOut,
    gone,
    unused: catalogue.products.filter((product) => product.available && !shown.has(product.handle)),
    damage,
  };
}
