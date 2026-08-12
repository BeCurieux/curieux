/**
 * The join between a `ShopConfig` and a live catalogue.
 *
 * These are the tests that keep the config from becoming a second, staler copy
 * of the catalogue. A config holds handles and merchandising decisions; every
 * fact a shopper acts on — price, stock, photograph — is looked up here, at
 * render time, from the data the ingester actually read.
 */

import { describe, expect, it } from "vitest";
import type { Catalogue, IngestedProduct } from "@/lib/ingest/types";
import { resolveAll, resolveProduct, stockState } from "@/lib/render/resolve";
import { formatFrom, formatMoney } from "@/lib/render/money";

function product(over: Partial<IngestedProduct> = {}): IngestedProduct {
  return {
    handle: "oat-crew",
    title: "Oat Crew",
    description: "A boxy wool crew in undyed oat.",
    tags: [],
    url: "https://kelpandcotton.com/products/oat-crew",
    images: [
      { url: "https://cdn.shopify.com/s/files/1/0001/oat-1.jpg", width: 1600, height: 2000 },
      { url: "https://cdn.shopify.com/s/files/1/0001/oat-2.jpg" },
      { url: "https://cdn.shopify.com/s/files/1/0001/oat-sage.jpg" },
    ],
    variants: [
      { id: "41001", title: "S / Oat", price: 148, available: true, options: ["S", "Oat"] },
      {
        id: "41002",
        title: "M / Sage",
        price: 165,
        compareAtPrice: 185,
        available: false,
        options: ["M", "Sage"],
        imageUrl: "https://cdn.shopify.com/s/files/1/0001/oat-sage.jpg",
      },
    ],
    price: { min: 148, max: 165 },
    available: true,
    availabilityKnown: true,
    ...over,
  };
}

function catalogue(products: IngestedProduct[], currency: string | null = "GBP"): Catalogue {
  return { currency, products, productCount: products.length, truncated: false };
}

describe("resolving a product reference", () => {
  it("reads price and stock from the catalogue, not from the config", () => {
    // The whole reason the config carries no prices: a shop published in March
    // and opened in June shows June's numbers without regenerating anything.
    const march = catalogue([product()]);
    const june = catalogue([product({ price: { min: 99, max: 99 }, available: false })]);

    expect(resolveProduct({ handle: "oat-crew" }, march)!.price).toBe(148);

    const later = resolveProduct({ handle: "oat-crew" }, june)!;
    expect(later.price).toBe(99);
    expect(stockState(later)).toBe("sold-out");
  });

  it("drops a product that has left the catalogue instead of rendering a dead card", () => {
    const only = catalogue([product()]);
    expect(resolveProduct({ handle: "discontinued" }, only)).toBeNull();
    expect(resolveAll([{ handle: "oat-crew" }, { handle: "discontinued" }], only)).toHaveLength(1);
  });

  it("lets a pinned variant fix the price and clear the range", () => {
    const resolved = resolveProduct({ handle: "oat-crew", variantId: "41002" }, catalogue([product()]))!;
    expect(resolved.price).toBe(165);
    expect(resolved.priceVaries).toBe(false);
    expect(resolved.available).toBe(false);
  });

  it("reports a real range when no variant was pinned", () => {
    expect(resolveProduct({ handle: "oat-crew" }, catalogue([product()]))!.priceVaries).toBe(true);

    const single = product({ variants: [product().variants[0]!], price: { min: 148, max: 148 } });
    expect(resolveProduct({ handle: "oat-crew" }, catalogue([single]))!.priceVaries).toBe(false);
  });

  it("prefers a pinned variant's own photograph over the art direction", () => {
    // Showing the oatmeal photo beside the sage price is a worse error than
    // ignoring the merchandiser's leadImageIndex.
    const resolved = resolveProduct(
      { handle: "oat-crew", variantId: "41002", leadImageIndex: 0 },
      catalogue([product()]),
    )!;
    expect(resolved.image?.url).toContain("oat-sage.jpg");
  });

  it("honours leadImageIndex when nothing is pinned, and falls back when it is stale", () => {
    const chosen = resolveProduct({ handle: "oat-crew", leadImageIndex: 1 }, catalogue([product()]))!;
    expect(chosen.image?.url).toContain("oat-2.jpg");

    // The validator rejects an out-of-range index at generation time, but a
    // catalogue can lose an image after publication — blanking the card then
    // would be the renderer punishing the shopper for the merchant's edit.
    const stale = resolveProduct({ handle: "oat-crew", leadImageIndex: 9 }, catalogue([product()]))!;
    expect(stale.image?.url).toContain("oat-1.jpg");
  });

  it("carries no image at all for a product with no photographs", () => {
    const bare = resolveProduct({ handle: "oat-crew" }, catalogue([product({ images: [] })]))!;
    expect(bare.image).toBeUndefined();
  });

  it("only reports a sale the store is actually running", () => {
    const onSale = resolveProduct({ handle: "oat-crew", variantId: "41002" }, catalogue([product()]))!;
    expect(onSale.compareAtPrice).toBe(185);

    // A compare-at that is not above the price is not a sale, it is noise.
    const notASale = product({
      variants: [{ id: "41001", title: "S", price: 148, compareAtPrice: 148, available: true, options: ["S"] }],
      price: { min: 148, max: 148 },
    });
    expect(resolveProduct({ handle: "oat-crew" }, catalogue([notASale]))!.compareAtPrice).toBeUndefined();
  });
});

describe("stock state", () => {
  it("has three cases, because two would make the renderer lie", () => {
    const known = resolveProduct({ handle: "oat-crew" }, catalogue([product()]))!;
    expect(stockState(known)).toBe("available");

    const gone = resolveProduct({ handle: "oat-crew" }, catalogue([product({ available: false })]))!;
    expect(stockState(gone)).toBe("sold-out");

    // Some ingest surfaces never report availability. "In stock" would be a
    // claim nobody checked; "sold out" would cost the merchant a sale.
    const unsure = resolveProduct(
      { handle: "oat-crew" },
      catalogue([product({ available: true, availabilityKnown: false })]),
    )!;
    expect(stockState(unsure)).toBe("unknown");
  });
});

describe("printing a price", () => {
  it("uses the store's own currency", () => {
    expect(formatMoney(148, "GBP")).toBe("£148");
    expect(formatMoney(18.5, "GBP")).toBe("£18.50");
  });

  it("prints a bare number rather than guessing a currency", () => {
    // The tempting bug: reaching for a dollar sign because a bare number looks
    // unfinished, and printing the wrong currency on a real merchant's page.
    expect(formatMoney(148, null)).toBe("148");
    expect(formatMoney(18.5, null)).toBe("18.50");
    expect(formatMoney(148, null)).not.toContain("$");
  });

  it("drops the decimals a zero-decimal currency never had", () => {
    expect(formatMoney(2400, "JPY")).not.toContain(".");
  });

  it("shows an unrecognised code instead of swallowing the number", () => {
    expect(formatMoney(148, "XYZ")).toContain("148");
    expect(formatMoney(148, "XYZ")).toContain("XYZ");
  });

  it("says 'from' when the range is real", () => {
    expect(formatFrom(148, "GBP")).toBe("from £148");
  });
});
