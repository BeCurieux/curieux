import { describe, expect, it } from "vitest";
import {
  assortmentRole,
  defaultPrice,
  inventoryDepth,
  itemTypeRule,
  marginBand,
  percentileOf,
  priceBand,
  pricePositions,
  type PricedProduct,
} from "@/lib/genome/v1/deterministic";

describe("price_band", () => {
  it("bands the handoff's worked example — navy linen shirt, $89 AUD — as mid", () => {
    const band = priceBand(89, "apparel", "AUD");
    expect(band.value).toBe("mid");
    expect(band.comparisonScope).toBe("global_reference");
    expect(band.rawValue).toContain("89 AUD");
  });

  it("uses each ceiling inclusively", () => {
    expect(priceBand(50, "apparel", "AUD").value).toBe("budget");
    expect(priceBand(50.01, "apparel", "AUD").value).toBe("mid");
    expect(priceBand(351, "apparel", "AUD").value).toBe("luxury");
  });

  it("is unknown without a reference rather than converting currencies", () => {
    expect(priceBand(89, "apparel", "JPY").value).toBe("unknown");
    expect(priceBand(89, null, "AUD").value).toBe("unknown");
    expect(priceBand(null, "apparel", "AUD").value).toBe("unknown");
  });
});

describe("price_position", () => {
  const shirts = (n: number, type = "Shirts"): PricedProduct[] =>
    Array.from({ length: n }, (_, i) => ({ handle: `${type}-${i}`, productType: type, price: 10 + i * 10 }));

  it("ranks within the product type when it has at least ten", () => {
    const positions = pricePositions([...shirts(12), ...shirts(3, "Hats")]);
    const cheapest = positions.get("Shirts-0")!;
    expect(cheapest).toMatchObject({ value: "entry", comparisonScope: "product_type", comparisonN: 12 });
    expect(positions.get("Shirts-11")!.value).toBe("premium");
    expect(positions.get("Shirts-6")!.value).toBe("mid");
  });

  it("falls back to the whole store when the type is too small", () => {
    const positions = pricePositions([...shirts(8), ...shirts(3, "Hats")]);
    expect(positions.get("Hats-0")).toMatchObject({ comparisonScope: "store", comparisonN: 11 });
  });

  it("falls back to the global reference, via price_band, in a store of fewer than ten", () => {
    const positions = pricePositions(shirts(4), (h) => (h === "Shirts-0" ? "budget" : "luxury"));
    expect(positions.get("Shirts-0")).toMatchObject({ value: "entry", comparisonScope: "global_reference", comparisonN: null });
    expect(positions.get("Shirts-3")!.value).toBe("premium");
  });

  it("is unknown with no price, and splits ties to the middle", () => {
    expect(pricePositions([{ handle: "x", productType: null, price: null }]).get("x")!.value).toBe("unknown");
    expect(percentileOf(20, Array(12).fill(20))).toBe(50);
  });
});

describe("inventory_depth", () => {
  it("uses days of cover when sales history exists (M3 onwards)", () => {
    expect(inventoryDepth({ units: 31, dailyUnits: 31 / 42, available: true, availabilityKnown: true, merchantMin: 5 })).toMatchObject({
      value: "normal",
      rawValue: "31 units, 42 days",
    });
    expect(inventoryDepth({ units: 10, dailyUnits: 1, available: true, availabilityKnown: true, merchantMin: 5 }).value).toBe("low");
    expect(inventoryDepth({ units: 100, dailyUnits: 1, available: true, availabilityKnown: true, merchantMin: 5 }).value).toBe("high");
  });

  it("compares units with the merchant's minimum when there is no history (M1)", () => {
    expect(inventoryDepth({ units: 3, available: true, availabilityKnown: true, merchantMin: 5 }).value).toBe("low");
    expect(inventoryDepth({ units: 300, available: true, availabilityKnown: true, merchantMin: 5 }).value).toBe("normal");
  });

  it("on the public path knows only that sold out is low", () => {
    expect(inventoryDepth({ available: false, availabilityKnown: true, merchantMin: 5 }).value).toBe("low");
    expect(inventoryDepth({ available: true, availabilityKnown: true, merchantMin: 5 }).value).toBe("unknown");
    expect(inventoryDepth({ available: false, availabilityKnown: false, merchantMin: 5 }).value).toBe("unknown");
  });
});

describe("margin_band", () => {
  it("bands from cost per item and never estimates without it", () => {
    expect(marginBand(100, 70).value).toBe("low");
    expect(marginBand(100, 50).value).toBe("mid");
    expect(marginBand(100, 40).value).toBe("mid");
    expect(marginBand(100, 30).value).toBe("high");
    expect(marginBand(100, undefined).value).toBe("unknown");
    expect(marginBand(null, 30).value).toBe("unknown");
  });
});

describe("assortment_role and item_type rules", () => {
  it("applies the cold-start rules and marks them provisional", () => {
    expect(assortmentRole({ itemType: "accessory", pricePosition: "entry", featured: false })).toMatchObject({ value: "add_on", evidenceState: "provisional" });
    expect(assortmentRole({ itemType: "core_item", pricePosition: "premium", featured: true })).toMatchObject({ value: "hero", evidenceState: "provisional" });
    expect(assortmentRole({ itemType: "core_item", pricePosition: "mid", featured: false })).toMatchObject({ value: "neutral", evidenceState: "unobserved" });
  });

  it("makes a Shopify bundle a set, and says nothing otherwise", () => {
    expect(itemTypeRule(true)!.value).toBe("set_bundle");
    expect(itemTypeRule(false)).toBeNull();
  });

  it("prices the default variant before any discount", () => {
    expect(defaultPrice([{ price: 60, compareAtPrice: 89 }, { price: 10 }])).toBe(89);
    expect(defaultPrice([{ price: 89 }])).toBe(89);
    expect(defaultPrice([])).toBeNull();
  });
});
