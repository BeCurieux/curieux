/**
 * Creator shops, end to end: published, read back, rendered.
 *
 * The feature is small on purpose — a creator shop is the same object as any
 * other, with a name attached — so what is worth guarding is not that it works
 * but that the attribution behaves like a fact rather than like content.
 *
 * Three specific ways it could stop being one:
 *
 *   A model could reach it. `ShopConfig` must have no field for a creator, so
 *   nothing the merchandiser returns can ever put a real person's name on a
 *   page. That is a structural check, not a prompt instruction.
 *
 *   A republish could lose it. Regenerating a shop is the common case and the
 *   command does not repeat the attribution, so a patch applied
 *   unconditionally would quietly strip somebody's name off their own shop.
 *
 *   The page could overclaim it. "Chosen by" is what happened; anything about
 *   a partnership or an endorsement is a commercial claim this system has no
 *   knowledge of and no right to make.
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createLocalStore, publishShop, readCreator } from "@/lib/publish/index";
import type { ShopStore } from "@/lib/publish/store";
import { Shop } from "@/components/shop/Shop";
import { ShopConfig } from "@/lib/schema";
import type { Catalogue, IngestResult, IngestedProduct } from "@/lib/ingest/types";

const ANA = readCreator({ handle: "@ana.ruiz", name: "Ana Ruiz", url: "https://instagram.com/ana.ruiz" });

function product(): IngestedProduct {
  return {
    handle: "oat-crew",
    title: "Oat Crew",
    description: "A boxy wool crew.",
    tags: [],
    url: "https://kelpandcotton.com/products/oat-crew",
    images: [{ url: "https://cdn/oat.jpg", width: 1600, height: 2000 }],
    variants: [{ id: "1", title: "S", price: 148, available: true, options: ["S"] }],
    price: { min: 148, max: 148 },
    available: true,
    availabilityKnown: true,
  };
}

const CATALOGUE: Catalogue = { currency: "GBP", products: [product()], productCount: 1, truncated: false };

const INGEST = {
  store: { storeUrl: "https://kelpandcotton.com", ingestedAt: "2026-08-01T09:00:00.000Z" },
  brand: { name: "Kelp & Cotton", storeUrl: "https://kelpandcotton.com" },
  catalogue: CATALOGUE,
} as unknown as IngestResult;

function configFor(prompt = "a warm gift edit"): ShopConfig {
  return ShopConfig.parse({
    version: 1,
    brand: { name: "Kelp & Cotton", storeUrl: "https://kelpandcotton.com" },
    theme: {
      colorway: { background: "#faf8f4", surface: "#f0ebe1", text: "#22201d", accent: "#2f5d50" },
      typography: "editorial-serif",
      mood: "editorial",
      density: "regular",
      cornerRadius: "soft",
    },
    blocks: [{ id: "grid", block: { type: "productGrid", layout: "grid", products: [{ handle: "oat-crew" }] } }],
    meta: { prompt, generatedAt: "2026-08-01T09:00:00.000Z" },
  });
}

let dir: string;
let store: ShopStore;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "popuup-creator-"));
  store = createLocalStore({ dir });
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("publishing a creator's shop", () => {
  it("names the URL after both the brand and the creator", async () => {
    const result = await publishShop({ config: configFor(), ingest: INGEST, creator: ANA }, { store });
    expect(result.shop.slug).toBe("kelp-and-cotton-ana-ruiz");
    expect(result.shop.creator).toEqual(ANA);
  });

  it("leaves an ordinary shop with no creator and a pinned selection", async () => {
    const result = await publishShop({ config: configFor(), ingest: INGEST }, { store });
    expect(result.shop.slug).toBe("kelp-and-cotton");
    expect(result.shop.creator).toBeNull();
    expect(result.shop.refresh).toBe("pinned");
  });

  it("keeps the attribution across a regeneration that does not mention it", async () => {
    // The common case, and the one that would fail silently: `pnpm generate`
    // is re-run with the same slug and no `--creator`, because the shop is
    // being remade rather than reassigned.
    await publishShop({ config: configFor("v1"), ingest: INGEST, slug: "ana", creator: ANA, refresh: "live" }, { store });
    const again = await publishShop({ config: configFor("v2"), ingest: INGEST, slug: "ana" }, { store });

    expect(again.shop.version).toBe(2);
    expect(again.shop.creator).toEqual(ANA);
    expect(again.shop.refresh).toBe("live");
  });

  it("clears the attribution only when asked to, explicitly", async () => {
    await publishShop({ config: configFor(), ingest: INGEST, slug: "ana", creator: ANA }, { store });
    const cleared = await publishShop({ config: configFor(), ingest: INGEST, slug: "ana", creator: null }, { store });
    expect(cleared.shop.creator).toBeNull();
  });

  it("reads back through the same path a page uses", async () => {
    await publishShop({ config: configFor(), ingest: INGEST, slug: "ana", creator: ANA }, { store });

    const loaded = await store.loadBySlug("ana");
    expect(loaded?.creator).toEqual(ANA);

    // And through the list, which is what a CLI enumerates.
    const listed = await store.listPublished();
    expect(listed.find((shop) => shop.slug === "ana")?.creator).toEqual(ANA);
  });
});

describe("the contract keeps the creator away from the model", () => {
  it("has no creator anywhere in ShopConfig", () => {
    // The guarantee behind the whole design: a merchandiser response cannot
    // credit anybody, because there is nowhere in the schema to put a name.
    // Written against the shape rather than against a rendered page, since the
    // point is that the field does not exist to be filled.
    expect(Object.keys(ShopConfig.shape)).not.toContain("creator");
    expect(JSON.stringify(ShopConfig.shape.brand.shape)).not.toMatch(/creator/i);

    const config = configFor();
    expect(JSON.stringify(config)).not.toMatch(/creator/i);
  });
});

describe("the credit on the page", () => {
  const render = (creator: Parameters<typeof Shop>[0]["creator"]) =>
    renderToStaticMarkup(<Shop config={configFor()} catalogue={CATALOGUE} slug="ana" creator={creator} />);

  it("credits the creator, linked to their profile", () => {
    const html = render(ANA);
    expect(html).toContain("Chosen by Ana Ruiz");
    expect(html).toContain('href="https://instagram.com/ana.ruiz"');
  });

  it("renders nothing at all when there is no creator", () => {
    const html = render(null);
    expect(html).not.toMatch(/Chosen by/);
    expect(html).not.toContain("credit");
  });

  it("claims nothing about a commercial arrangement", () => {
    // The page knows a name was passed at publish time. It knows nothing about
    // a partnership, a commission or an endorsement, and every one of those
    // words is a claim made on somebody else's behalf.
    const html = render(ANA);
    expect(html).not.toMatch(/\b(partner\w*|sponsor\w*|ambassador|affiliate|exclusive|official)\b/i);
  });

  it("credits without a link when no profile was given", () => {
    const html = render(readCreator({ handle: "ana.ruiz" }));
    expect(html).toContain("Chosen by ana.ruiz");
    expect(html).not.toContain('href="https://instagram.com/ana.ruiz"');
  });
});
