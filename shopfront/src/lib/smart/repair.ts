/**
 * Mending a shop against current stock, without asking a model anything.
 *
 * Two moves, and only two:
 *
 *   **Drop what is gone.** A handle no longer in the catalogue renders as
 *   nothing the renderer can resolve. It leaves.
 *
 *   **Demote what is sold out.** It stays on the page, marked, because the
 *   brief is explicit that sold-out is shown and never hidden — but it moves
 *   behind the things a shopper can actually buy. A page whose first three
 *   cards are unbuyable is a page that reads as abandoned.
 *
 * What this deliberately does **not** do is add anything. Pulling an unused
 * product into a grid means writing a blurb for it, deciding where it sits and
 * whether it belongs next to what is around it — that is merchandising, it is
 * what the model is for, and a rule that guessed at it would be the page
 * builder arriving through the back door. When mending is not enough, the
 * answer is `regenerate`, not a cleverer rule.
 *
 * Every result is re-validated against `ShopConfig` before it is returned. A
 * repair that produced an invalid config would be a mutation nobody had to
 * write markup for and nobody had to validate — exactly the hole the one
 * architectural law exists to close.
 */

import { ShopConfig } from "@/lib/schema";
import type { Catalogue } from "@/lib/ingest/types";
import type { CatalogueDrift } from "./drift";

export interface RepairResult {
  config: ShopConfig;
  /** Handles removed because they left the catalogue. */
  dropped: string[];
  /** Handles moved behind the in-stock ones. */
  demoted: string[];
  /** Fewest products left in any product-bearing block. Feeds `decide`. */
  smallestBlock: number;
}

export function repair(config: ShopConfig, catalogue: Catalogue, drift: CatalogueDrift): RepairResult {
  const gone = new Set(drift.gone.map((entry) => entry.handle));
  const stock = new Map(catalogue.products.map((product) => [product.handle, product.available]));

  const dropped: string[] = [];
  const demoted: string[] = [];
  const sizes: number[] = [];

  const blocks = config.blocks.map(({ id, block }) => {
    switch (block.type) {
      case "productGrid":
      case "drop": {
        const kept = block.products.filter((product) => !gone.has(product.handle));

        /*
         * A block that would be emptied is left exactly as it was.
         *
         * `ProductGridBlock` requires at least one product, so mending it to
         * nothing produces a config the contract refuses — and because this
         * runs speculatively, before `decide` has ruled, that would throw on
         * shops whose answer was going to be "regenerate" anyway. Reporting
         * zero says the same thing without the exception: `decide` reads it,
         * sees a block too thin to be one, and asks for a regeneration.
         *
         * The untouched block is never served. It exists only so the size can
         * be measured.
         */
        if (kept.length === 0) {
          sizes.push(0);
          return { id, block };
        }

        for (const product of block.products) {
          if (gone.has(product.handle)) dropped.push(product.handle);
        }

        const ordered = inStockFirst(kept, stock, demoted);
        sizes.push(ordered.length);
        return { id, block: { ...block, products: ordered } };
      }

      case "routine": {
        /*
         * A routine is not reorderable and its steps are not droppable in the
         * same way: "step 2" means something, and a routine missing its middle
         * is not a routine with a gap, it is wrong. So a routine with a gone
         * product is reported at zero, which sends `decide` to `regenerate`.
         */
        const missing = block.steps.filter((step) => gone.has(step.product.handle));
        for (const step of missing) dropped.push(step.product.handle);
        sizes.push(missing.length > 0 ? 0 : block.steps.length);
        return { id, block };
      }

      case "hero": {
        // A hero whose image product has left falls back to no media rather
        // than to another product's photograph. The headline was written about
        // something; pairing it with a different object is a small lie the
        // renderer would tell confidently.
        if (block.media?.kind === "productImage" && gone.has(block.media.handle)) {
          dropped.push(block.media.handle);
          const { media: _media, ...rest } = block;
          return { id, block: rest };
        }
        return { id, block };
      }

      default:
        return { id, block };
    }
  });

  // Parsed, not cast. If a repair ever produces something the contract refuses,
  // this is where it stops — before it reaches a page.
  const repaired = ShopConfig.parse({ ...config, blocks });

  return {
    config: repaired,
    dropped,
    demoted,
    smallestBlock: sizes.length === 0 ? Number.POSITIVE_INFINITY : Math.min(...sizes),
  };
}

/**
 * In-stock products keep their order; sold-out ones fall to the back keeping
 * theirs.
 *
 * A stable partition rather than a sort, because the order inside each group is
 * the merchandiser's decision and there is no reason to disturb it. `Array.sort`
 * is stable in modern engines, but writing the partition says what is meant.
 */
function inStockFirst<T extends { handle: string }>(
  products: T[],
  stock: Map<string, boolean>,
  demoted: string[],
): T[] {
  const available: T[] = [];
  const out: T[] = [];

  for (const product of products) {
    if (stock.get(product.handle) === false) out.push(product);
    else available.push(product);
  }

  // Only a product that actually moved counts as demoted. A grid whose last
  // card was already the sold-out one has not changed.
  if (out.length > 0 && available.length > 0) {
    const moved = products.findIndex((product) => stock.get(product.handle) === false);
    if (moved < products.length - out.length) demoted.push(...out.map((product) => product.handle));
  }

  return [...available, ...out];
}
