import { describe, expect, it } from "vitest";
import { parseMoney, parseProductList, parseSingleProduct } from "@/lib/ingest/products";
import { PRODUCTS_JSON, PRODUCT_JS } from "./helpers/fixtures";

const storeUrl = new URL("https://kelpandcotton.com/");

describe("parseMoney", () => {
  it("reads a string as decimal and a number as minor units", () => {
    // The hundredfold bug lives here. A string "24.00" and a number 2400 are
    // the same price from two Shopify endpoints.
    expect(parseMoney("24.00")).toBe(24);
    expect(parseMoney(2400)).toBe(24);
    expect(parseMoney("148.50")).toBe(148.5);
    expect(parseMoney(14850)).toBe(148.5);
    expect(parseMoney(0)).toBe(0);
  });

  it("does not guess the unit from the magnitude", () => {
    // A $2,400 product exists. It must not be read as $24.
    expect(parseMoney("2400.00")).toBe(2400);
  });

  it("returns null rather than a plausible number", () => {
    expect(parseMoney(null)).toBeNull();
    expect(parseMoney(undefined)).toBeNull();
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("free")).toBeNull();
    expect(parseMoney(-100)).toBeNull();
    expect(parseMoney(Number.NaN)).toBeNull();
  });
});

describe("parseProductList", () => {
  const products = parseProductList(JSON.parse(PRODUCTS_JSON), { storeUrl });

  it("normalises the list endpoint", () => {
    expect(products).toHaveLength(2);
    const crew = products[0]!;
    expect(crew.handle).toBe("oat-crew");
    expect(crew.title).toBe("Oat Crew");
    expect(crew.url).toBe("https://kelpandcotton.com/products/oat-crew");
    expect(crew.productType).toBe("Knitwear");
    expect(crew.tags).toEqual(["wool", "unisex", "bestseller"]);
    expect(crew.price).toEqual({ min: 148, max: 148 });
  });

  it("turns body_html into readable text with block boundaries intact", () => {
    expect(products[0]!.description).toBe("A boxy wool crew in undyed oat. Knitted in Porto.");
  });

  it("keeps sold-out products, because they are shown and marked, never hidden", () => {
    const teaTowel = products.find((p) => p.handle === "linen-tea-towel")!;
    expect(teaTowel.available).toBe(false);
    expect(teaTowel.availabilityKnown).toBe(true);
  });

  it("treats a product as available when any variant is", () => {
    const crew = products[0]!;
    expect(crew.available).toBe(true);
    expect(crew.variants.map((v) => v.available)).toEqual([true, false]);
  });

  it("orders images by the position the shop set", () => {
    expect(products[0]!.images.map((i) => i.url)).toEqual([
      "https://cdn.shopify.com/s/files/1/0001/oat-crew-1.jpg",
      "https://cdn.shopify.com/s/files/1/0001/oat-crew-2.jpg",
    ]);
    expect(products[0]!.images[0]).toMatchObject({ width: 1600, height: 2000 });
  });

  it("keeps a compare-at price only when it is above the price", () => {
    const [small, medium] = products[0]!.variants;
    expect(small!.compareAtPrice).toBe(185);
    expect(medium!.compareAtPrice).toBeUndefined();
  });

  it("stringifies ids, because Shopify's are wider than a JSON number", () => {
    expect(products[0]!.variants[0]!.id).toBe("41001");
    expect(products[0]!.id).toBe("7001");
  });

  it("drops products with no readable variant instead of pricing them at zero", () => {
    const parsed = parseProductList(
      { products: [{ handle: "ghost", title: "Ghost", variants: [] }] },
      { storeUrl },
    );
    expect(parsed).toEqual([]);
  });

  it("skips unreadable entries without losing the readable ones", () => {
    const parsed = parseProductList(
      {
        products: [
          null,
          { title: "No handle", variants: [{ id: 1, price: "10.00", available: true }] },
          { handle: "good", title: "Good", variants: [{ id: 2, price: "10.00", available: true }] },
        ],
      },
      { storeUrl },
    );
    expect(parsed.map((p) => p.handle)).toEqual(["good"]);
  });

  it("returns nothing for a payload that is not a product list", () => {
    expect(parseProductList({ errors: "Not Found" }, { storeUrl })).toEqual([]);
    expect(parseProductList("<!doctype html>", { storeUrl })).toEqual([]);
  });
});

describe("parseSingleProduct", () => {
  const product = parseSingleProduct(JSON.parse(PRODUCT_JS), { storeUrl })!;

  it("reads the .js endpoint's minor units and bare image URLs", () => {
    expect(product.price).toEqual({ min: 215, max: 215 });
    expect(product.images.map((i) => i.url)).toEqual([
      "https://cdn.shopify.com/s/files/1/0001/throw-1.jpg",
      "https://cdn.shopify.com/s/files/1/0001/throw-2.jpg",
    ]);
    expect(product.productType).toBe("Home");
    expect(product.description).toBe("A heavy throw in undyed wool.");
  });

  it("does not repeat the featured image when it also appears in the list", () => {
    expect(product.images).toHaveLength(2);
  });

  it("records that availability was a fallback when the store never said", () => {
    const unknown = parseSingleProduct(
      { handle: "x", title: "X", variants: [{ id: 1, price: 1000 }] },
      { storeUrl },
    )!;
    expect(unknown.available).toBe(true);
    expect(unknown.availabilityKnown).toBe(false);
  });
});
