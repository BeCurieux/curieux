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
