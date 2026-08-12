/**
 * The two fields the model is never asked for.
 *
 * Both exist because a model answering them is confidently wrong in a way that
 * is hard to notice: price tier looks plausible until you check it against the
 * store's own range, and a photography flag guessed from a title is pure
 * invention. These tests are the argument for computing them.
 */

import { describe, expect, it } from "vitest";
import { computePriceBands, priceTierFor, readPhotography } from "@/lib/genome/heuristics";
import type { Catalogue, IngestedProduct } from "@/lib/ingest/types";

function product(over: Partial<IngestedProduct> = {}): IngestedProduct {
  return {
    handle: "p",
    title: "P",
    description: "",
    tags: [],
    url: "https://example.com/products/p",
    images: [],
    variants: [],
    price: { min: 10, max: 10 },
    available: true,
    availabilityKnown: true,
    ...over,
  };
}

function catalogueOf(prices: number[]): Catalogue {
  return {
    currency: "GBP",
    products: prices.map((price, index) =>
      product({ handle: `p${index}`, price: { min: price, max: price } }),
    ),
    productCount: prices.length,
    truncated: false,
  };
}

describe("price tier", () => {
  it("is relative to this store and no other", () => {
    // The whole point. £180 is entry-level in one of these shops and flagship
    // in the other, and any absolute threshold gets one of them wrong.
    const luxury = catalogueOf([180, 240, 380, 520, 900, 1400]);
    const highStreet = catalogueOf([8, 14, 22, 35, 48, 180]);

    const bands = { luxury: computePriceBands(luxury), highStreet: computePriceBands(highStreet) };
    const item = product({ price: { min: 180, max: 180 } });

    expect(priceTierFor(item, bands.luxury)).toBe("entry");
    expect(priceTierFor(item, bands.highStreet)).toBe("flagship");
  });

  it("says nothing rather than splitting three products into four tiers", () => {
    const bands = computePriceBands(catalogueOf([20, 20, 20]));
    expect(bands.entryBelow).toBeNull();
    expect(priceTierFor(product(), bands)).toBe("core");
  });

  it("does not invent a spread across a flat catalogue", () => {
    // Six products at one price is not four tiers of anything.
    const bands = computePriceBands(catalogueOf([25, 25, 25, 25, 25, 25]));
    expect(bands.entryBelow).toBeNull();
  });

  it("sorts a real catalogue into all four tiers", () => {
    const prices = [6, 9, 12, 18, 24, 30, 42, 55, 80, 120, 240];
    const bands = computePriceBands(catalogueOf(prices));
    const tiers = new Set(
      prices.map((price) => priceTierFor(product({ price: { min: price, max: price } }), bands)),
    );
    expect(tiers).toEqual(new Set(["entry", "core", "premium", "flagship"]));
  });
});

describe("photography", () => {
  it("distinguishes 'no image' from 'we never measured'", () => {
    // The same discipline as availabilityKnown on the catalogue. Recording
    // "weak" for an image nobody measured is asserting a fact we do not have.
    const none = readPhotography(product({ images: [] }));
    expect(none.rating).toBe("none");
    expect(none.dimensionsKnown).toBe(false);

    const unmeasured = readPhotography(
      product({ images: [{ url: "a.jpg" }, { url: "b.jpg" }, { url: "c.jpg" }] }),
    );
    expect(unmeasured.dimensionsKnown).toBe(false);
    expect(unmeasured.notes.join(" ")).toContain("not reported");
  });

  it("never rates unmeasured imagery as strong", () => {
    // `strong` is what the merchandiser leans on to pick a hero, so it has to
    // mean measured-and-good rather than absent-of-evidence.
    const unmeasured = readPhotography(
      product({ images: [{ url: "a.jpg" }, { url: "b.jpg" }, { url: "c.jpg" }, { url: "d.jpg" }] }),
    );
    expect(unmeasured.rating).not.toBe("strong");
  });

  it("marks a thumbnail weak and says why", () => {
    const tiny = readPhotography(product({ images: [{ url: "a.jpg", width: 200, height: 200 }] }));
    expect(tiny.rating).toBe("weak");
    expect(tiny.notes.join(" ")).toContain("200×200");
  });

  it("marks a very wide photograph weak, because the plate crop discards it", () => {
    const wide = readPhotography(product({ images: [{ url: "a.jpg", width: 2400, height: 700 }] }));
    expect(wide.rating).toBe("weak");
    expect(wide.notes.join(" ")).toMatch(/3\.4:1/);
  });

  it("rates a real product shoot strong", () => {
    const good = readPhotography(
      product({
        images: [
          { url: "a.jpg", width: 1600, height: 2000 },
          { url: "b.jpg", width: 1600, height: 2000 },
          { url: "c.jpg", width: 1600, height: 2000 },
        ],
      }),
    );
    expect(good.rating).toBe("strong");
    expect(good.notes).toHaveLength(0);
  });

  it("notes a single image, since there is no fallback if it crops badly", () => {
    const one = readPhotography(product({ images: [{ url: "a.jpg", width: 1600, height: 2000 }] }));
    expect(one.rating).toBe("adequate");
    expect(one.notes.join(" ")).toContain("Only one image");
  });
});
