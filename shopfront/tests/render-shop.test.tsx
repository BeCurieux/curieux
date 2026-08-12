/**
 * The honesty rules, asserted against the markup a shopper actually receives.
 *
 * Everything else in the test suite checks a function. This checks the page.
 * Each of these corresponds to a line in the brief that a rendering bug could
 * quietly break without any type failing: sold-out shown and marked rather
 * than hidden, no block claiming data we never ingested, and no sentence
 * anywhere promising a live connection that does not exist yet.
 */

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Shop } from "@/components/shop/Shop";
import type { Catalogue, IngestedProduct } from "@/lib/ingest/types";
import type { ShopConfig } from "@/lib/schema";
import { ShopConfig as ShopConfigSchema } from "@/lib/schema";

type Blocks = ShopConfig["blocks"];

function product(over: Partial<IngestedProduct> = {}): IngestedProduct {
  return {
    handle: "oat-crew",
    title: "Oat Crew",
    description: "A boxy wool crew in undyed oat.",
    tags: [],
    url: "https://kelpandcotton.com/products/oat-crew",
    images: [{ url: "https://cdn.shopify.com/s/files/1/0001/oat-1.jpg", width: 1600, height: 2000 }],
    variants: [{ id: "41001", title: "S", price: 148, available: true, options: ["S"] }],
    price: { min: 148, max: 148 },
    available: true,
    availabilityKnown: true,
    ...over,
  };
}

const CATALOGUE: Catalogue = {
  currency: "GBP",
  products: [
    product(),
    product({
      handle: "linen-tea-towel",
      title: "Linen Tea Towel",
      url: "https://kelpandcotton.com/products/linen-tea-towel",
      images: [{ url: "https://cdn.shopify.com/s/files/1/0001/tea-towel.jpg" }],
      variants: [{ id: "41010", title: "Default Title", price: 18.5, available: false, options: ["Default Title"] }],
      price: { min: 18.5, max: 18.5 },
      available: false,
    }),
    product({
      handle: "wool-throw",
      title: "Wool Throw",
      url: "https://kelpandcotton.com/products/wool-throw",
      images: [],
      variants: [{ id: "41020", title: "Default Title", price: 215, available: true, options: ["Default Title"] }],
      price: { min: 215, max: 215 },
      available: true,
    }),
  ],
  productCount: 3,
  truncated: false,
};

function config(blocks: Blocks): ShopConfig {
  return ShopConfigSchema.parse({
    version: 1,
    brand: {
      name: "Kelp & Cotton",
      tagline: "Slow basics for a warm house",
      storeUrl: "https://kelpandcotton.com",
    },
    theme: {
      colorway: { background: "#faf8f4", surface: "#f2eee6", text: "#22201d", accent: "#2f5d50" },
      typography: "editorial-serif",
      mood: "editorial",
      density: "regular",
      cornerRadius: "soft",
    },
    blocks,
    meta: { prompt: "a warm gift edit under £60", generatedAt: "2026-08-01T09:00:00.000Z" },
  });
}

const HERO: Blocks[number] = {
  id: "hero",
  block: { type: "hero", headline: "Made to be mended", subline: "Knitted in Porto, in runs of fifty" },
};

function markup(blocks: Blocks, ingestedAt?: string): string {
  return renderToStaticMarkup(
    <Shop config={config(blocks)} catalogue={CATALOGUE} {...(ingestedAt ? { ingestedAt } : {})} />,
  );
}

describe("what reaches the shopper", () => {
  it("shows a sold-out product, marked, rather than hiding it", () => {
    // The brief is explicit. Hiding it is the easy bug: the page looks tidier
    // and the merchant loses the one product a shopper came back for.
    const html = markup([
      HERO,
      {
        id: "grid",
        block: {
          type: "productGrid",
          title: "The edit",
          layout: "grid",
          products: [{ handle: "oat-crew" }, { handle: "linen-tea-towel" }],
        },
      },
    ]);

    expect(html).toContain("Linen Tea Towel");
    expect(html).toContain("Sold out");
    expect(html).toContain("card--soldout");
  });

  it("says nothing at all about stock it never read", () => {
    const html = renderToStaticMarkup(
      <Shop
        config={config([HERO, { id: "grid", block: { type: "productGrid", layout: "grid", products: [{ handle: "oat-crew" }] } }])}
        catalogue={{
          ...CATALOGUE,
          products: [product({ availabilityKnown: false })],
          productCount: 1,
        }}
      />,
    );
    expect(html).not.toContain("Sold out");
    expect(html).not.toContain("In stock");
  });

  it("prints the catalogue's prices, in the catalogue's currency", () => {
    const html = markup([
      HERO,
      { id: "grid", block: { type: "productGrid", layout: "grid", products: [{ handle: "oat-crew" }, { handle: "linen-tea-towel" }] } },
    ]);
    expect(html).toContain("£148");
    expect(html).toContain("£18.50");
  });

  it("makes no claim of sync, liveness or social proof anywhere on the page", () => {
    // Sprint 1 has no OAuth, no webhooks and no review ingestion. A page that
    // says otherwise is the single most damaging thing this renderer could do,
    // because the merchant would believe it too.
    const html = markup(
      [
        HERO,
        { id: "grid", block: { type: "productGrid", title: "The edit", layout: "grid", products: [{ handle: "oat-crew" }] } },
        { id: "offer", block: { type: "offer", code: "WARMTH", description: "10% off the knitwear this week" } },
        { id: "links", block: { type: "linkList", links: [{ label: "Our workshop", url: "https://kelpandcotton.com/pages/about" }] } },
      ],
      "2026-08-01T09:00:00.000Z",
    ).toLowerCase();

    for (const claim of [
      "always in sync",
      "live inventory",
      "real-time",
      "realtime",
      "syncs automatically",
      "automatically synced",
      "reviews",
      "rating",
      "verified buyer",
      "in stock now",
      "selling fast",
      "only",
    ]) {
      expect(html, `page claims "${claim}"`).not.toContain(claim);
    }
  });

  it("dates the prices, because a snapshot is not a feed", () => {
    const html = markup([HERO], "2026-08-01T09:00:00.000Z");
    expect(html).toContain("Prices and availability as of");
    expect(html).toMatch(/August/);

    // The dateline reads in the shopper's order, not the developer's.
    const british = renderToStaticMarkup(
      <Shop config={config([HERO])} catalogue={CATALOGUE} ingestedAt="2026-08-01T09:00:00.000Z" locale="en-GB" />,
    );
    expect(british).toContain("1 August");
  });

  it("omits the dateline rather than inventing one", () => {
    expect(markup([HERO])).not.toContain("Prices and availability as of");
  });

  it("renders nothing for the blocks whose data does not exist yet", () => {
    // Reviews are not ingestable from a public storefront and nothing is wired
    // to receive an email address. Both are in the schema; neither may appear.
    const html = markup([
      HERO,
      { id: "reviews", block: { type: "reviews", title: "What people say", maxEntries: 3 } },
      { id: "capture", block: { type: "capture", channel: "email", headline: "Get the drop first" } },
    ]);

    expect(html).not.toContain("What people say");
    expect(html).not.toContain("Get the drop first");
    expect(html).not.toContain("<input");
    expect(html).not.toContain("<form");
  });

  it("drops a reference to a product that has left the catalogue", () => {
    const html = markup([
      HERO,
      {
        id: "grid",
        block: { type: "productGrid", layout: "grid", products: [{ handle: "oat-crew" }, { handle: "discontinued" }] },
      },
    ]);
    expect(html).toContain("Oat Crew");
    expect(html).not.toContain("discontinued");
  });

  it("drops a block entirely when nothing in it resolves", () => {
    const html = markup([
      HERO,
      { id: "gone", block: { type: "productGrid", title: "Winter", layout: "grid", products: [{ handle: "discontinued" }] } },
    ]);
    expect(html).not.toContain("Winter");
  });

  it("gives a product with no photograph a plate rather than a broken image", () => {
    // A missing <img> is how a generated page announces itself. The initial,
    // set large, is a design decision standing in for a grey rectangle.
    const html = markup([
      HERO,
      { id: "grid", block: { type: "productGrid", layout: "grid", products: [{ handle: "wool-throw" }] } },
    ]);
    expect(html).toContain("plate--empty");
    expect(html).toContain("Wool Throw");
    expect(html).not.toContain('src=""');
  });

  it("sends every card to the merchant's own domain and nowhere else", () => {
    // Step 6 made the destination conditional — a cart permalink when there is
    // one variant this could mean, the product page otherwise. What must not
    // vary is the host: a purchase can only complete on the merchant's own
    // storefront, and a card pointing anywhere else is the worst thing this
    // system could ship.
    const html = markup([
      HERO,
      {
        id: "grid",
        block: {
          type: "productGrid",
          layout: "grid",
          products: [{ handle: "oat-crew" }, { handle: "linen-tea-towel" }, { handle: "wool-throw" }],
        },
      },
    ]);

    const hrefs = [...html.matchAll(/<a class="card[^"]*" href="([^"]+)"/g)].map((m) => m[1]!);
    expect(hrefs.length).toBe(3);
    for (const href of hrefs) {
      expect(new URL(href).origin, href).toBe("https://kelpandcotton.com");
    }
  });

  it("gives the hero one eager image and leaves the rest lazy", () => {
    const html = markup([
      {
        id: "hero",
        block: {
          type: "hero",
          headline: "Made to be mended",
          media: { kind: "productImage", handle: "oat-crew", imageIndex: 0 },
        },
      },
      { id: "grid", block: { type: "productGrid", layout: "grid", products: [{ handle: "oat-crew" }] } },
    ]);
    expect(html.match(/loading="eager"/g)).toHaveLength(1);
    expect(html).toContain('loading="lazy"');
  });

  it("numbers a routine, because the order is the merchandising", () => {
    const html = markup([
      HERO,
      {
        id: "routine",
        block: {
          type: "routine",
          title: "The winter layer",
          steps: [
            { label: "Start here", product: { handle: "oat-crew" } },
            { label: "Then this", product: { handle: "wool-throw" } },
          ],
        },
      },
    ]);
    expect(html).toContain("Start here");
    expect(html).toContain(">1<");
    expect(html).toContain(">2<");
  });

  it("carries the theme as custom properties, so one stylesheet serves every shop", () => {
    const html = markup([HERO]);
    expect(html).toContain("--accent");
    expect(html).toContain("--bg");
    // The law: the AI fills a schema, it never writes markup. Nothing in a
    // config may reach the page as a tag or a style rule of its own.
    expect(html).not.toContain("<style");
  });
});
