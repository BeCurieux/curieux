/**
 * Screening a candidate storefront.
 *
 * The screener's job is to be boring and right. What it must not do is reject a
 * store that would have been a good target, or wave through one that turns the
 * kill test into a test of something else — both of which are invisible at the
 * time and expensive thirty merchants later.
 *
 * The case worth holding hardest is the photography one. A catalogue of single
 * studio images is the renderer's *easiest* input, and the brief explicitly
 * asks for a handful of hard ones, so thin imagery has to read as a reason to
 * include rather than a defect. It is the rule most likely to get "tidied" into
 * a demotion by somebody reading the code without the brief.
 */

import { describe, expect, it } from "vitest";
import { GENOME_READS, MIN_PRODUCTS, screen } from "@/lib/killtest/screen";
import type { Catalogue, IngestedProduct } from "@/lib/ingest/types";

function product(over: Partial<IngestedProduct> = {}): IngestedProduct {
  return {
    handle: "thing",
    title: "Thing",
    description: "",
    tags: [],
    url: "https://store.com/products/thing",
    images: [{ url: "https://cdn/a.jpg", width: 1200, height: 1500 }],
    variants: [{ id: "1", title: "One", price: 40, available: true, options: ["One"] }],
    price: { min: 40, max: 40 },
    available: true,
    availabilityKnown: true,
    ...over,
  };
}

function catalogue(count: number, over: Partial<IngestedProduct> = {}, rest: Partial<Catalogue> = {}): Catalogue {
  const products = Array.from({ length: count }, (_, i) => product({ ...over, handle: `p${i}` }));
  return { currency: "USD", products, productCount: products.length, truncated: false, ...rest };
}

describe("screening a storefront", () => {
  it("passes a store with enough to merchandise", () => {
    const result = screen("https://store.com", catalogue(60, { images: [{ url: "a" }, { url: "b" }] as never }));
    expect(result.verdict).toBe("good");
    expect(result.productCount).toBe(60);
    expect(result.line).not.toMatch(/^#/);
  });

  it("rejects a store with nothing to select from", () => {
    // Under the floor there is no merchandising to judge — the shop that comes
    // out tests the renderer, and a merchant saying no to it says nothing about
    // the product.
    const result = screen("https://tiny.com", catalogue(MIN_PRODUCTS - 1));
    expect(result.verdict).toBe("wrong-test");
    expect(result.notes[0]).toMatch(/nothing to merchandise/);
  });

  it("rejects a feed it could not read at all", () => {
    const result = screen("https://closed.com", null);
    expect(result.verdict).toBe("wrong-test");
    expect(result.line).toMatch(/NOTHING READABLE/);
  });

  it("comments out a rejected store rather than dropping it", () => {
    // A batch is pasted wholesale. A target that vanished silently is one
    // nobody ever reconsiders.
    expect(screen("https://tiny.com", catalogue(3)).line.startsWith("#")).toBe(true);
  });

  it("treats thin photography as a reason to include, not a defect", () => {
    // The brief: the template "must flatter mediocre product photography".
    // Thirty catalogues of clean cut-outs test the easy case thirty times.
    const result = screen("https://rough.com", catalogue(40));
    expect(result.verdict).toBe("good");
    expect(result.notes.join(" ")).toMatch(/mediocre-photography sample/);
    expect(result.line).toMatch(/POOR PHOTOGRAPHY/);
  });

  /*
   * The widening, and the run that forced it.
   *
   * The rule above asked one question — does any product carry two images —
   * and across sixty real candidates the answer was yes every time, so the
   * sample came back empty and the screener said so. Counting uploads is not
   * measuring photography: four phone pictures score the same as a studio.
   */
  describe("photography, past the image count", () => {
    /** A studio: one crop, repeated, at a size the card does not have to upscale. */
    const studio = { images: [{ url: "a", width: 1600, height: 2000 }, { url: "b" }] as never };

    it("does not flag a catalogue shot to a template", () => {
      const result = screen("https://studio.com", catalogue(40, studio));
      expect(result.hardPhotography).toBe(false);
      expect(result.framingConsistency).toBe(1);
      expect(result.line).not.toMatch(/POOR PHOTOGRAPHY/);
    });

    it("flags a catalogue photographed in mixed crops", () => {
      // Portrait, landscape and square in one grid is a merchant with a phone,
      // and it is exactly the input the renderer has to cope with.
      const shapes = [
        { width: 1600, height: 2000 },
        { width: 2000, height: 1500 },
        { width: 1800, height: 1800 },
      ];
      const products = Array.from({ length: 42 }, (_, i) => ({
        ...product({ handle: `p${i}` }),
        images: [{ url: "a", ...shapes[i % 3]! }, { url: "b" }],
      }));

      const result = screen("https://mixed.com", { currency: "GBP", products, productCount: 42, truncated: false });
      expect(result.verdict).toBe("good");
      expect(result.hardPhotography).toBe(true);
      expect(result.notes.join(" ")).toMatch(/share a crop/);
      expect(result.line).toMatch(/POOR PHOTOGRAPHY/);
    });

    it("flags images too small for the card to fill", () => {
      const result = screen("https://small.com", {
        ...catalogue(30, { images: [{ url: "a", width: 600, height: 750 }, { url: "b" }] as never }),
      });
      expect(result.medianLongEdge).toBe(750);
      expect(result.hardPhotography).toBe(true);
      expect(result.notes.join(" ")).toMatch(/upscale/);
    });

    it("reads an unmeasurable feed as unknown, never as well photographed", () => {
      // Dimensions are optional in `/products.json` and often absent. Treating
      // silence as a pass would quietly re-create the bug this widening fixes.
      const result = screen("https://nodims.com", catalogue(40, { images: [{ url: "a" }, { url: "b" }] as never }));
      expect(result.framingConsistency).toBeNull();
      expect(result.medianLongEdge).toBeNull();
      expect(result.hardPhotography).toBe(false);
    });

    it("tolerates a studio catalogue carrying a few lifestyle shots", () => {
      // The threshold is loose on purpose: a handful of odd crops is a normal
      // product page, not a merchant without a studio.
      const products = Array.from({ length: 40 }, (_, i) => ({
        ...product({ handle: `p${i}` }),
        images: [{ url: "a", width: 1600, height: i < 4 ? 1600 : 2000 }, { url: "b" }],
      }));
      const result = screen("https://mostly.com", { currency: "GBP", products, productCount: 40, truncated: false });
      expect(result.hardPhotography).toBe(false);
    });
  });

  it("flags a catalogue larger than the Genome reads, without rejecting it", () => {
    const result = screen("https://big.com", catalogue(GENOME_READS + 40));
    expect(result.verdict).toBe("workable");
    expect(result.notes.join(" ")).toMatch(new RegExp(`first ${GENOME_READS}`));
  });

  it("flags a mostly sold-out catalogue", () => {
    const products = [
      ...Array.from({ length: 30 }, (_, i) => product({ handle: `out${i}`, available: false })),
      ...Array.from({ length: 10 }, (_, i) => product({ handle: `in${i}` })),
    ];
    const result = screen("https://empty.com", { currency: "USD", products, productCount: 40, truncated: false });
    expect(result.verdict).toBe("workable");
    expect(result.notes.join(" ")).toMatch(/10 of 40 in stock/);
  });

  it("notes a missing currency, because prices will render bare", () => {
    const result = screen("https://nocur.com", catalogue(40, {}, { currency: null }));
    expect(result.notes.join(" ")).toMatch(/no currency/);
  });

  it("never upgrades a rejected store back to workable", () => {
    // Order of checks must not decide the answer: a store that is too small is
    // the wrong test whatever else is true of it.
    const result = screen("https://tiny.com", catalogue(4, {}, { truncated: true, currency: null }));
    expect(result.verdict).toBe("wrong-test");
  });
});
