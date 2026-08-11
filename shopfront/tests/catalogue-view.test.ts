import { describe, expect, it } from "vitest";
import { renderCatalogue } from "@/lib/merchandise/catalogue-view";
import type { Catalogue, IngestedProduct } from "@/lib/ingest/types";
import { makeIngest } from "./helpers/ingest";

const catalogue = makeIngest().catalogue;

describe("renderCatalogue", () => {
  const view = renderCatalogue(catalogue);

  it("gives the model one line per product, with what selection needs", () => {
    const crew = view.text.split("\n").find((line) => line.startsWith("oat-crew"))!;
    expect(crew).toContain("Oat Crew");
    expect(crew).toContain("148");
    expect(crew).toContain("in stock");
    expect(crew).toContain("Knitwear");
    expect(crew).toContain("2 img");
    expect(crew).toContain("A boxy wool crew");
  });

  it("states the currency once, in the header", () => {
    expect(view.text.split("\n")[0]).toContain("price (GBP)");
  });

  it("marks sold out and missing imagery, which both change the merchandising", () => {
    expect(view.text).toContain("sold out");
    expect(view.text.split("\n").find((l) => l.startsWith("care-card"))).toContain("NO IMAGE");
  });

  it("says the currency is unstated rather than picking one", () => {
    const unpriced = renderCatalogue({ ...catalogue, currency: null });
    expect(unpriced.text.split("\n")[0]).toContain("unstated currency");
  });

  it("lists variant ids only where pinning one changes the price", () => {
    // That is the only thing ProductRef.variantId exists for. For a
    // single-price product the ids are tokens that buy nothing.
    expect(view.text).not.toContain("variants:");

    const varied = renderCatalogue({
      ...catalogue,
      products: [{ ...catalogue.products[0]!, price: { min: 148, max: 168 } } as IngestedProduct],
    });
    expect(varied.text).toContain("variants: 41001");
    expect(varied.text).toContain("41002");
  });
});

describe("compaction under size", () => {
  const many = (count: number): Catalogue => ({
    ...catalogue,
    products: Array.from({ length: count }, (_, i) => ({
      ...catalogue.products[0]!,
      handle: `product-${i}`,
      title: `Product ${i}`,
    })),
    productCount: count,
  });

  it("drops descriptions before it drops products, and says so", () => {
    const view = renderCatalogue(many(200), { descriptionsBelow: 150 });
    expect(view.descriptionsIncluded).toBe(false);
    expect(view.text).not.toContain("A boxy wool crew");
    expect(view.warnings.some((w) => w.includes("descriptions were dropped"))).toBe(true);
  });

  it("reports products it withheld rather than silently truncating", () => {
    const view = renderCatalogue(many(400), { maxProducts: 300 });
    expect(view.included).toBe(300);
    expect(view.omitted).toBe(100);
    expect(view.warnings.some((w) => w.includes("100 were not offered"))).toBe(true);
  });

  it("keeps descriptions for a catalogue small enough to afford them", () => {
    expect(renderCatalogue(many(20), { descriptionsBelow: 150 }).descriptionsIncluded).toBe(true);
  });
});
