/**
 * Shop refresh.
 *
 * Three things are worth holding here, and only one of them is about stock.
 *
 * The first is that mending never invents. A rule that reached into the
 * catalogue for a replacement product would be merchandising without a model
 * and without a prompt — the page builder arriving through the back door, which
 * is the one thing the north star forbids.
 *
 * The second is that mending never hides a sold-out product. The brief is
 * explicit: shown and marked, never hidden. Moving one back is not the same as
 * dropping it, and a repair that "tidied up" the page by removing them would be
 * breaking a product rule while passing every arithmetic test.
 *
 * The third is that the output is a valid `ShopConfig`, parsed rather than
 * asserted. Repair is the only path in the system that mutates a config without
 * a model in the loop, so it is the only one where the schema is not already
 * standing guard.
 */

import { describe, expect, it } from "vitest";
import { MIN_PRODUCTS_PER_BLOCK, REGENERATE_ABOVE, readDrift, refreshShop, repair } from "@/lib/smart/index";
import { ShopConfig } from "@/lib/schema";
import type { Catalogue, IngestedProduct } from "@/lib/ingest/types";

function product(handle: string, available = true): IngestedProduct {
  return {
    handle,
    title: handle,
    description: "",
    tags: [],
    url: `https://kelpandcotton.com/products/${handle}`,
    images: [{ url: `https://cdn/${handle}.jpg`, width: 1200, height: 1500 }],
    variants: [{ id: `${handle}-1`, title: "One", price: 40, available, options: ["One"] }],
    price: { min: 40, max: 40 },
    available,
    availabilityKnown: true,
  };
}

function catalogue(products: IngestedProduct[]): Catalogue {
  return { currency: "GBP", products, productCount: products.length, truncated: false };
}

function configWith(handles: string[]): ShopConfig {
  return ShopConfig.parse({
    version: 1,
    brand: { name: "Kelp & Cotton", storeUrl: "https://kelpandcotton.com" },
    theme: {
      colorway: { background: "#faf8f4", surface: "#f0ebe1", text: "#22201d", accent: "#2f5d50" },
      typography: "editorial-serif",
      mood: "editorial",
      density: "regular",
      cornerRadius: "soft",
    },
    blocks: [
      {
        id: "grid",
        block: { type: "productGrid", title: "The edit", layout: "grid", products: handles.map((h) => ({ handle: h })) },
      },
    ],
    meta: { prompt: "a warm gift edit", generatedAt: "2026-08-01T09:00:00.000Z" },
  });
}

const SIX = ["a", "b", "c", "d", "e", "f"];

describe("reading drift", () => {
  it("separates what sold out from what left the catalogue", () => {
    const drift = readDrift(
      configWith(["a", "b", "c"]),
      catalogue([product("a"), product("b", false), product("z")]),
    );

    expect(drift.soldOut.map((entry) => entry.handle)).toEqual(["b"]);
    expect(drift.gone.map((entry) => entry.handle)).toEqual(["c"]);
    // `z` is in the catalogue and not on the page. That is the fact; "new
    // arrival" is a claim this has no way to support.
    expect(drift.unused.map((p) => p.handle)).toEqual(["z"]);
  });

  it("counts a delisted product as worse than a sold-out one", () => {
    const gone = readDrift(configWith(["a", "b"]), catalogue([product("a")]));
    const sold = readDrift(configWith(["a", "b"]), catalogue([product("a"), product("b", false)]));
    expect(gone.damage).toBeGreaterThan(sold.damage);
  });

  it("finds products referenced from a hero and a routine, not just a grid", () => {
    // The bug this exists for: drift computed from grids alone reports a clean
    // page while the hero points at a product that no longer exists.
    const config = ShopConfig.parse({
      ...configWith(["a"]),
      blocks: [
        {
          id: "hero",
          block: {
            type: "hero",
            headline: "Warm things",
            media: { kind: "productImage", handle: "hero-item", imageIndex: 0 },
          },
        },
        {
          id: "routine",
          block: {
            type: "routine",
            title: "In order",
            steps: [
              { label: "One", product: { handle: "step-one" } },
              { label: "Two", product: { handle: "step-two" } },
            ],
          },
        },
      ],
    });

    const drift = readDrift(config, catalogue([product("step-one")]));
    expect(drift.gone.map((entry) => entry.handle).sort()).toEqual(["hero-item", "step-two"]);
  });
});

describe("mending", () => {
  it("drops what is gone and moves sold-out products behind the buyable ones", () => {
    const config = configWith(["a", "b", "c", "d"]);
    const now = catalogue([product("a"), product("b", false), product("d")]);
    const result = repair(config, now, readDrift(config, now));

    const grid = result.config.blocks[0]!.block;
    if (grid.type !== "productGrid") throw new Error("expected a grid");

    expect(grid.products.map((p) => p.handle)).toEqual(["a", "d", "b"]);
    expect(result.dropped).toEqual(["c"]);
    expect(result.demoted).toEqual(["b"]);
  });

  it("shows the sold-out product rather than hiding it", () => {
    // The product rule, as a test. Everything else about a repair could be
    // right and this still be wrong, and it would look like an improvement.
    const config = configWith(["a", "b"]);
    const now = catalogue([product("a"), product("b", false)]);
    const result = repair(config, now, readDrift(config, now));

    const grid = result.config.blocks[0]!.block;
    if (grid.type !== "productGrid") throw new Error("expected a grid");
    expect(grid.products.map((p) => p.handle)).toContain("b");
  });

  it("never adds a product the shop was not already showing", () => {
    // The line between mending and merchandising. Pulling `z` in would mean
    // deciding it belongs and writing a blurb for it, neither of which a rule
    // can do — that is what the model and the prompt are for.
    const config = configWith(["a", "b"]);
    const now = catalogue([product("a"), product("b"), product("z"), product("y")]);
    const result = repair(config, now, readDrift(config, now));

    const grid = result.config.blocks[0]!.block;
    if (grid.type !== "productGrid") throw new Error("expected a grid");
    expect(grid.products.map((p) => p.handle)).toEqual(["a", "b"]);
  });

  it("drops a hero's media rather than pairing the headline with another product", () => {
    const config = ShopConfig.parse({
      ...configWith(["a"]),
      blocks: [
        {
          id: "hero",
          block: {
            type: "hero",
            headline: "The oat crew, in every weight",
            media: { kind: "productImage", handle: "oat-crew", imageIndex: 0 },
          },
        },
        { id: "grid", block: { type: "productGrid", layout: "grid", products: [{ handle: "a" }] } },
      ],
    });

    const now = catalogue([product("a")]);
    const result = repair(config, now, readDrift(config, now));
    const hero = result.config.blocks[0]!.block;
    if (hero.type !== "hero") throw new Error("expected a hero");

    expect(hero.media).toBeUndefined();
    expect(hero.headline).toBe("The oat crew, in every weight");
  });

  it("returns a config the contract accepts, parsed not asserted", () => {
    const config = configWith(["a", "b", "c"]);
    const now = catalogue([product("a"), product("b", false), product("c")]);
    const result = repair(config, now, readDrift(config, now));
    expect(() => ShopConfig.parse(result.config)).not.toThrow();
  });
});

describe("deciding", () => {
  it("holds a pinned shop however much has moved", () => {
    const config = configWith(["a", "b", "c"]);
    const now = catalogue([]);
    expect(refreshShop({ config, catalogue: now, policy: "pinned" }).decision.action).toBe("hold");
  });

  it("holds a live shop whose products are all still listed and in stock", () => {
    const config = configWith(["a", "b"]);
    const now = catalogue([product("a"), product("b")]);
    const outcome = refreshShop({ config, catalogue: now, policy: "live" });
    expect(outcome.decision.action).toBe("hold");
    expect(outcome.config).toBeNull();
  });

  it("mends a live shop when one product of six has gone", () => {
    const config = configWith(SIX);
    const now = catalogue(SIX.filter((h) => h !== "c").map((h) => product(h)));
    const outcome = refreshShop({ config, catalogue: now, policy: "live" });

    expect(outcome.decision.action).toBe("repair");
    expect(outcome.dropped).toEqual(["c"]);
    expect(outcome.config).not.toBeNull();
  });

  it("asks for a regeneration once the damage is past mending", () => {
    // Three of six gone is 50%, comfortably over the threshold. What is left
    // after mending is an arbitrary half of somebody's selection, which is
    // worse than either the stale page or an honest new one.
    const config = configWith(SIX);
    const now = catalogue(["a", "b", "c"].map((h) => product(h)));
    const outcome = refreshShop({ config, catalogue: now, policy: "live" });

    expect(outcome.decision.action).toBe("regenerate");
    expect(outcome.config).toBeNull();
    expect(outcome.decision.reason).toMatch(/50%/);
  });

  it("regenerates rather than leaving a block too thin to be one", () => {
    /*
     * The shape the second gate exists for, and it only appears across
     * blocks. A big grid absorbs the damage arithmetic — one product gone out
     * of ten is 10%, well under the threshold — while the small block those
     * losses actually fell on is left with a single card. A grid of one is not
     * a grid, and a merchant looking at it would ask what happened.
     */
    const config = ShopConfig.parse({
      ...configWith(["a"]),
      blocks: [
        {
          id: "main",
          block: {
            type: "productGrid",
            title: "The edit",
            layout: "grid",
            products: SIX.concat(["g", "h"]).map((h) => ({ handle: h })),
          },
        },
        {
          id: "pair",
          block: { type: "productGrid", title: "Also", layout: "stack", products: [{ handle: "y" }, { handle: "z" }] },
        },
      ],
    });

    const now = catalogue([...SIX, "g", "h", "y"].map((h) => product(h)));
    const outcome = refreshShop({ config, catalogue: now, policy: "live" });

    // Sanity: this really is the thin-block gate and not the damage one.
    expect(readDrift(config, now).damage).toBeLessThanOrEqual(REGENERATE_ABOVE);
    expect(outcome.decision.action).toBe("regenerate");
    expect(outcome.decision.reason).toMatch(/block/i);
  });

  it("does not throw when mending would empty a block outright", () => {
    // The repair runs speculatively, before the decision, so a config it
    // cannot legally produce has to come back as a measurement rather than as
    // an exception. Everything gone is the extreme case.
    const config = configWith(["a", "b", "c"]);
    const now = catalogue([]);
    expect(() => refreshShop({ config, catalogue: now, policy: "live" })).not.toThrow();
    expect(refreshShop({ config, catalogue: now, policy: "live" }).decision.action).toBe("regenerate");
  });

  it("regenerates a routine with a hole in it rather than mending one", () => {
    // A routine's steps are ordered and labelled. "Step 2" missing is not a
    // routine with a gap; it is a routine that is wrong.
    const config = ShopConfig.parse({
      ...configWith(["a"]),
      blocks: [
        {
          id: "routine",
          block: {
            type: "routine",
            title: "In order",
            steps: [
              { label: "One", product: { handle: "one" } },
              { label: "Two", product: { handle: "two" } },
              { label: "Three", product: { handle: "three" } },
            ],
          },
        },
      ],
    });

    const now = catalogue([product("one"), product("three")]);
    expect(refreshShop({ config, catalogue: now, policy: "live" }).decision.action).toBe("regenerate");
  });

  it("holds once a shop has already been mended, however much is still sold out", () => {
    /*
     * Idempotence, and the bug it was written for. Drift does not go away when
     * it is dealt with — the products stay sold out — so a decision made on
     * drift alone goes on saying "repair" forever, and `pnpm refresh --all
     * --apply` on a schedule appends an identical version every run.
     *
     * Found by running the real thing against a real catalogue, not by reading
     * this file.
     */
    const config = configWith(["a", "b", "c"]);
    const now = catalogue([product("a"), product("b", false), product("c")]);

    const first = refreshShop({ config, catalogue: now, policy: "live" });
    expect(first.decision.action).toBe("repair");
    expect(first.config).not.toBeNull();

    const second = refreshShop({ config: first.config!, catalogue: now, policy: "live" });
    expect(second.decision.action).toBe("hold");
    expect(second.config).toBeNull();

    // Still sold out, and still on the page. Holding is not the same as having
    // decided the drift went away.
    expect(readDrift(first.config!, now).soldOut.map((entry) => entry.handle)).toEqual(["b"]);
  });

  it("keeps its thresholds where a person can argue with them", () => {
    // Not a behaviour test. These two numbers are the whole policy, and the
    // reason they are constants rather than tuned values is that somebody who
    // watches thirty shops drift should be able to find and change them.
    expect(REGENERATE_ABOVE).toBeGreaterThan(0);
    expect(REGENERATE_ABOVE).toBeLessThan(1);
    expect(MIN_PRODUCTS_PER_BLOCK).toBeGreaterThanOrEqual(1);
  });
});
