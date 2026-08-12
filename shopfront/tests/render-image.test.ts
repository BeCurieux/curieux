import { describe, expect, it } from "vitest";
import { CARD_WIDTHS, imageAttrs, isResizable, sizedImageUrl, srcSetFor } from "@/lib/render/image";

const SHOPIFY = "https://cdn.shopify.com/s/files/1/0001/oat-crew.jpg?v=17";
const OTHER = "https://images.example.com/oat-crew.jpg";

describe("asking the CDN for a size", () => {
  it("adds a width to a Shopify URL and keeps the rest of it", () => {
    const sized = new URL(sizedImageUrl(SHOPIFY, 360));
    expect(sized.searchParams.get("width")).toBe("360");
    expect(sized.searchParams.get("v")).toBe("17");
  });

  it("leaves a host whose resizing convention we do not know alone", () => {
    // Guessing a query parameter at a stranger's CDN either does nothing or
    // returns a 404 where a photograph should be.
    expect(isResizable(OTHER)).toBe(false);
    expect(sizedImageUrl(OTHER, 360)).toBe(OTHER);
    expect(srcSetFor(OTHER, CARD_WIDTHS)).toBeUndefined();
  });

  it("builds a srcset a browser can actually choose within", () => {
    const srcSet = srcSetFor(SHOPIFY, [180, 360])!;
    expect(srcSet).toContain("width=180 180w");
    expect(srcSet).toContain("width=360 360w");
  });

  it("falls back to the product title rather than inventing alt text", () => {
    // A made-up description of a photograph nobody read is the same class of
    // fabrication as a made-up price.
    const attrs = imageAttrs({ url: SHOPIFY }, { widths: CARD_WIDTHS, sizes: "45vw", alt: "Oat Crew" })!;
    expect(attrs.alt).toBe("Oat Crew");

    const described = imageAttrs(
      { url: SHOPIFY, alt: "A boxy crew on a chair" },
      { widths: CARD_WIDTHS, sizes: "45vw", alt: "Oat Crew" },
    )!;
    expect(described.alt).toBe("A boxy crew on a chair");
  });

  it("passes the intrinsic size through so the plate does not jump", () => {
    const attrs = imageAttrs({ url: SHOPIFY, width: 1600, height: 2000 }, { widths: CARD_WIDTHS, sizes: "45vw", alt: "x" })!;
    expect(attrs.width).toBe(1600);
    expect(attrs.height).toBe(2000);
  });

  it("returns nothing at all for a product with no photograph", () => {
    expect(imageAttrs(undefined, { widths: CARD_WIDTHS, sizes: "45vw", alt: "x" })).toBeNull();
  });
});
