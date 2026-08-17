/**
 * Admin API products -> the ingester's `Catalogue`.
 *
 * **These fixtures are hand-built from the schema, not recorded from a real
 * response.** Field names are verified by live introspection; the response
 * shape is not, because this environment cannot make an Admin call. So what
 * follows proves the mapper does what the mapper was written to do, and stage 1
 * of the plan exists to find out whether that is what Shopify does. Said out
 * loud here as well as in SHOPIFY-APP.md §10, because a fixture that was never
 * a recording is easy to forget about a month later.
 */

import { describe, expect, it } from "vitest";
import { Catalogue, IngestedProduct } from "@/lib/ingest/types";
import { cartPermalink } from "@/lib/cart/permalink";
import { mapProduct, mapProductsPage, toCatalogue } from "@/lib/shopify/admin/catalogue";

const STORE = "https://kelpandcotton.com";
const options = { storeUrl: STORE };

/** One product node, in the shape the query in `catalogue.ts` asks for. */
function productNode(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "gid://shopify/Product/788032119674292922",
    handle: "kelp-crew",
    title: "Kelp Crew",
    descriptionHtml: "<p>A heavy <strong>merino</strong> crew.</p>",
    vendor: "Kelp & Cotton",
    productType: "Knitwear",
    tags: ["knitwear", "merino"],
    status: "ACTIVE",
    onlineStoreUrl: "https://kelpandcotton.com/products/kelp-crew",
    publishedAt: "2026-01-04T10:00:00Z",
    createdAt: "2026-01-02T10:00:00Z",
    updatedAt: "2026-08-01T10:00:00Z",
    media: {
      nodes: [
        { image: { url: "https://cdn.shopify.com/a.jpg", width: 2000, height: 2500, altText: "front" } },
        { image: { url: "https://cdn.shopify.com/b.jpg", width: 1600, height: 2000 } },
        // A video in the same connection: MediaImage-only fragment, so no image.
        {},
      ],
    },
    variants: {
      nodes: [
        {
          id: "gid://shopify/ProductVariant/45779434701121",
          legacyResourceId: "45779434701121",
          title: "Small",
          sku: "KC-CREW-S",
          price: "148.00",
          compareAtPrice: "185.00",
          availableForSale: true,
          selectedOptions: [{ name: "Size", value: "Small" }],
          image: { url: "https://cdn.shopify.com/a.jpg" },
        },
        {
          id: "gid://shopify/ProductVariant/45779434701122",
          legacyResourceId: "45779434701122",
          title: "Medium",
          price: "148.00",
          compareAtPrice: null,
          availableForSale: false,
          selectedOptions: [{ name: "Size", value: "Medium" }],
          image: null,
        },
      ],
    },
    ...overrides,
  };
}

function page(
  nodes: unknown[],
  pageInfo: { hasNextPage: boolean; endCursor: string | null } = {
    hasNextPage: false,
    endCursor: null,
  },
) {
  return { products: { pageInfo, nodes } };
}

describe("mapProduct", () => {
  it("produces something the ingester's own schema accepts", () => {
    // The load-bearing claim of the whole design: an Admin response maps into
    // the type everything downstream already reads. If this fails, the Genome,
    // the merchandiser, the renderer and lib/smart all need app-specific paths.
    const product = mapProduct(productNode(), options);
    expect(product).not.toBeNull();
    expect(() => IngestedProduct.parse(product)).not.toThrow();
  });

  it("uses the numeric variant id, so cart permalinks survive", () => {
    // The finding this file's header is about. `ProductVariant.id` is a gid;
    // `legacyResourceId` is the numeric id `lib/cart/permalink.ts` needs. A
    // mapper using the gid would not crash — every card would just quietly fall
    // back to the product page, on every app-backed shop, and the existing
    // guard would call that correct behaviour.
    const product = mapProduct(productNode(), options)!;
    const variant = product.variants[0]!;

    expect(variant.id).toBe("45779434701121");
    expect(variant.id).not.toContain("gid://");

    const permalink = cartPermalink({ storeUrl: STORE, variantId: variant.id });
    expect(permalink).toBe("https://kelpandcotton.com/cart/45779434701121:1");
  });

  it("would produce no permalink at all if the gid leaked through", () => {
    // The negative half of the same test, so the assertion above is known to be
    // about something. This is the failure mode, demonstrated.
    expect(
      cartPermalink({ storeUrl: STORE, variantId: "gid://shopify/ProductVariant/45779434701121" }),
    ).toBeNull();
  });

  it("reads Money as a decimal, never as minor units", () => {
    // `parseMoney`'s rule is decided by type, not magnitude: "24.00" is decimal,
    // 2400 is minor units. Admin `Money` is a string, so a £148 jumper must not
    // become £1.48 or £14,800.
    const product = mapProduct(productNode(), options)!;
    expect(product.variants[0]!.price).toBe(148);
    expect(product.price).toEqual({ min: 148, max: 148 });
  });

  it("drops a compare-at price that is not a discount", () => {
    const product = mapProduct(productNode(), options)!;
    // 185 > 148, so it is a real strike-through.
    expect(product.variants[0]!.compareAtPrice).toBe(185);
    // null on the second variant: nothing to strike through.
    expect(product.variants[1]!.compareAtPrice).toBeUndefined();

    const ended = mapProduct(
      productNode({
        variants: {
          nodes: [
            {
              legacyResourceId: "1",
              title: "One",
              price: "50.00",
              compareAtPrice: "50.00",
              availableForSale: true,
              selectedOptions: [],
            },
          ],
        },
      }),
      options,
    )!;
    // Equal is a leftover from an ended sale, not a discount. Printing it would
    // strike through a number that never was.
    expect(ended.variants[0]!.compareAtPrice).toBeUndefined();
  });

  it("keeps a sold-out variant instead of hiding it", () => {
    // The product rule: "Sold-out products are shown (marked), never hidden."
    // Filtering here would break it before the merchandiser ever saw it.
    const product = mapProduct(productNode(), options)!;
    expect(product.variants).toHaveLength(2);
    expect(product.variants[1]!.available).toBe(false);
    expect(product.available).toBe(true);
  });

  it("marks a fully sold-out product as unavailable but still returns it", () => {
    const product = mapProduct(
      productNode({
        variants: {
          nodes: [
            {
              legacyResourceId: "1",
              title: "One",
              price: "50.00",
              availableForSale: false,
              selectedOptions: [],
            },
          ],
        },
      }),
      options,
    );
    expect(product).not.toBeNull();
    expect(product!.available).toBe(false);
  });

  it("records availability as known, because availableForSale is non-null", () => {
    // A real difference from the public path, and an improvement: some public
    // rungs omit availability entirely, which is why `availabilityKnown` exists.
    // The Admin schema types this Boolean!, so an app-backed store always knows.
    const product = mapProduct(productNode(), options)!;
    expect(product.availabilityKnown).toBe(true);
  });

  it("treats a missing availableForSale as sold out rather than in stock", () => {
    // The one place this mapper is deliberately stricter than the public path.
    // There, a missing flag means "assume in stock and record that we guessed".
    // Here the field is non-null in the schema, so its absence means a malformed
    // response — and asserting a product is buyable off a malformed response is
    // how somebody's cart fails at checkout.
    const product = mapProduct(
      productNode({
        variants: {
          nodes: [{ legacyResourceId: "1", title: "One", price: "50.00", selectedOptions: [] }],
        },
      }),
      options,
    )!;
    expect(product.variants[0]!.available).toBe(false);
  });

  it("flattens selectedOptions to the values, in order", () => {
    const product = mapProduct(
      productNode({
        variants: {
          nodes: [
            {
              legacyResourceId: "1",
              title: "Small / Sage",
              price: "50.00",
              availableForSale: true,
              selectedOptions: [
                { name: "Size", value: "Small" },
                { name: "Colour", value: "Sage" },
              ],
            },
          ],
        },
      }),
      options,
    )!;
    expect(product.variants[0]!.options).toEqual(["Small", "Sage"]);
  });

  it("takes images out of the media connection, skipping non-image media", () => {
    // `Product` has no plain `images` field under the current product model, and
    // a media connection carries videos and 3D models alongside photographs.
    const product = mapProduct(productNode(), options)!;
    expect(product.images).toHaveLength(2);
    expect(product.images[0]).toEqual({
      url: "https://cdn.shopify.com/a.jpg",
      width: 2000,
      height: 2500,
      alt: "front",
    });
    // Dimensions matter: the Genome's `photography.dimensionsKnown` refuses to
    // rate imagery it never measured, and the renderer needs the aspect ratio.
    expect(product.images[1]!.width).toBe(1600);
  });

  it("converts the description to text the merchandiser can read", () => {
    const product = mapProduct(productNode(), options)!;
    expect(product.description).toBe("A heavy merino crew.");
    expect(product.description).not.toContain("<");
  });

  it("falls back to a canonical product URL when onlineStoreUrl is null", () => {
    // Null for a product not published to the online store. The shopper still
    // has to be sent somewhere, and this is the URL the public path builds.
    const product = mapProduct(productNode({ onlineStoreUrl: null }), options)!;
    expect(product.url).toBe("https://kelpandcotton.com/products/kelp-crew");
  });

  it("drops a product with no readable variant, exactly as the public path does", () => {
    // "A product with no readable variant has no price and no buy path. Keeping
    // it would put a card on the page that cannot be bought or priced."
    expect(mapProduct(productNode({ variants: { nodes: [] } }), options)).toBeNull();
    expect(
      mapProduct(
        productNode({ variants: { nodes: [{ legacyResourceId: "1", title: "x" }] } }),
        options,
      ),
    ).toBeNull();
  });

  it("drops a variant whose legacyResourceId is missing rather than falling back to the gid", () => {
    // Falling back would be the quiet-404 bug arriving through the back door.
    const product = mapProduct(
      productNode({
        variants: {
          nodes: [
            {
              id: "gid://shopify/ProductVariant/45779434701121",
              title: "One",
              price: "50.00",
              availableForSale: true,
              selectedOptions: [],
            },
          ],
        },
      }),
      options,
    );
    expect(product).toBeNull();
  });

  it("accepts legacyResourceId as a number, since UnsignedInt64 may deserialise as one", () => {
    const product = mapProduct(
      productNode({
        variants: {
          nodes: [
            {
              legacyResourceId: 45779434701121,
              title: "One",
              price: "50.00",
              availableForSale: true,
              selectedOptions: [],
            },
          ],
        },
      }),
      options,
    )!;
    expect(product.variants[0]!.id).toBe("45779434701121");
  });

  it("returns null for junk rather than a half-built product", () => {
    for (const junk of [null, undefined, "a string", 42, [], {}]) {
      expect(mapProduct(junk, options)).toBeNull();
    }
  });
});

describe("mapProductsPage", () => {
  it("maps a page and reports the cursor", () => {
    const result = mapProductsPage(
      page([productNode(), productNode({ handle: "kelp-hat", title: "Kelp Hat" })], {
        hasNextPage: true,
        endCursor: "eyJsYXN0X2lkIjo3ODgwMzJ9",
      }),
      options,
    );

    expect(result.products.map((p) => p.handle)).toEqual(["kelp-crew", "kelp-hat"]);
    expect(result.hasNextPage).toBe(true);
    expect(result.endCursor).toBe("eyJsYXN0X2lkIjo3ODgwMzJ9");
    expect(result.skipped).toBe(0);
  });

  it("counts what it could not map rather than swallowing it", () => {
    // The ingester's discipline: every attempt is visible, so "why did this
    // store come back short?" is a five-second question rather than a mystery.
    const result = mapProductsPage(page([productNode(), { handle: "broken" }, null]), options);
    expect(result.products).toHaveLength(1);
    expect(result.skipped).toBe(2);
  });

  it("reads an edges/node connection as well as nodes", () => {
    const result = mapProductsPage(
      {
        products: {
          pageInfo: { hasNextPage: false, endCursor: null },
          nodes: [productNode()],
        },
      },
      options,
    );
    expect(result.products).toHaveLength(1);
  });

  it("returns an empty page rather than throwing on a malformed response", () => {
    for (const junk of [null, undefined, {}, { products: null }, { products: {} }]) {
      const result = mapProductsPage(junk, options);
      expect(result.products).toEqual([]);
      expect(result.hasNextPage).toBe(false);
    }
  });
});

describe("toCatalogue", () => {
  it("produces something the ingester's Catalogue schema accepts", () => {
    const { products } = mapProductsPage(page([productNode()]), options);
    const catalogue = toCatalogue(products, { currency: "GBP" });
    expect(() => Catalogue.parse(catalogue)).not.toThrow();
    expect(catalogue.productCount).toBe(1);
    expect(catalogue.truncated).toBe(false);
  });

  it("leaves currency null when the caller never read one", () => {
    // "currency stays null when undeclared rather than defaulting to USD."
    // The app has a shop query that can answer this; a catalogue assembled
    // without it must still say it does not know.
    const catalogue = toCatalogue([], { currency: null });
    expect(catalogue.currency).toBeNull();
  });
});
