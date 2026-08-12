/**
 * Cart permalinks, and the decision about when *not* to build one.
 *
 * The brief: "one tap → pre-filled Shopify checkout via cart permalink. Do not
 * promise fully on-page checkout." The value is the tap saved; the risk is
 * sending somebody to a cart holding the wrong thing.
 */

import { describe, expect, it } from "vitest";
import { cartPermalink } from "@/lib/cart/permalink";
import { resolveProduct } from "@/lib/render/resolve";
import type { Catalogue, IngestedProduct } from "@/lib/ingest/types";

function product(over: Partial<IngestedProduct> = {}): IngestedProduct {
  return {
    handle: "oat-crew",
    title: "Oat Crew",
    description: "",
    tags: [],
    url: "https://kelpandcotton.com/products/oat-crew",
    images: [],
    variants: [{ id: "41001", title: "Default Title", price: 148, available: true, options: ["Default Title"] }],
    price: { min: 148, max: 148 },
    available: true,
    availabilityKnown: true,
    ...over,
  };
}

const catalogueOf = (products: IngestedProduct[]): Catalogue => ({
  currency: "GBP",
  products,
  productCount: products.length,
  truncated: false,
});

describe("cartPermalink", () => {
  it("builds the documented Shopify shape on the merchant's own origin", () => {
    const url = cartPermalink({ storeUrl: "https://kelpandcotton.com/collections/all", variantId: "41001" });
    expect(url).toBe("https://kelpandcotton.com/cart/41001:1");
  });

  it("carries a discount the merchant put in their own brief", () => {
    const url = cartPermalink({ storeUrl: "https://kelpandcotton.com", variantId: "41001", discount: "WARMTH" });
    expect(url).toBe("https://kelpandcotton.com/cart/41001:1?discount=WARMTH");
  });

  it("refuses an id that is not a Shopify variant id", () => {
    // A permalink built on a guess is a 404 where a purchase should be, which
    // is strictly worse than one more tap.
    expect(cartPermalink({ storeUrl: "https://kelpandcotton.com", variantId: "gid://shopify/Variant/41001" })).toBeNull();
    expect(cartPermalink({ storeUrl: "https://kelpandcotton.com", variantId: "" })).toBeNull();
  });

  it("refuses a store URL it cannot parse", () => {
    expect(cartPermalink({ storeUrl: "not a url", variantId: "41001" })).toBeNull();
  });
});

describe("which variant a buy link may pre-fill", () => {
  it("uses the only variant when there is only one", () => {
    const resolved = resolveProduct({ handle: "oat-crew" }, catalogueOf([product()]))!;
    expect(resolved.cartVariantId).toBe("41001");
  });

  it("uses a pinned variant, because the plan chose it and the card shows its price", () => {
    const sizes = product({
      variants: [
        { id: "41001", title: "S", price: 148, available: true, options: ["S"] },
        { id: "41002", title: "M", price: 148, available: true, options: ["M"] },
      ],
    });
    const resolved = resolveProduct({ handle: "oat-crew", variantId: "41002" }, catalogueOf([sizes]))!;
    expect(resolved.cartVariantId).toBe("41002");
  });

  it("refuses to choose a size on the shopper's behalf", () => {
    // Pre-filling the medium because it happened to be first sends somebody to
    // a checkout holding the wrong thing — and the shopper who does not notice
    // is the expensive case: a return, and a merchant who blames the shop.
    const sizes = product({
      variants: [
        { id: "41001", title: "S", price: 148, available: true, options: ["S"] },
        { id: "41002", title: "M", price: 148, available: true, options: ["M"] },
      ],
    });
    const resolved = resolveProduct({ handle: "oat-crew" }, catalogueOf([sizes]))!;
    expect(resolved.cartVariantId).toBeUndefined();
  });
});
