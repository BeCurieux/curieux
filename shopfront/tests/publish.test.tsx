/**
 * Publishing, against the local store.
 *
 * The two things worth guarding here are the ones a database would let you get
 * wrong quietly: a regeneration that overwrites the version a funnel event was
 * attributed to, and a Genome that rides along into what a page is handed.
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createLocalStore, publishShop, PublishError } from "@/lib/publish/index";
import type { ShopStore } from "@/lib/publish/store";
import { Shop } from "@/components/shop/Shop";
import { ShopConfig } from "@/lib/schema";
import type { CatalogueGenome } from "@/lib/genome/types";
import type { Catalogue, IngestResult, IngestedProduct } from "@/lib/ingest/types";

const GENOME_TELLTALE = "ZZQX-genome-must-not-be-served";

function product(over: Partial<IngestedProduct> = {}): IngestedProduct {
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
    ...over,
  };
}

const CATALOGUE: Catalogue = { currency: "GBP", products: [product()], productCount: 1, truncated: false };

function ingestFor(storeUrl = "https://kelpandcotton.com"): IngestResult {
  return {
    store: { storeUrl, ingestedAt: "2026-08-01T09:00:00.000Z" },
    brand: { name: "Kelp & Cotton", storeUrl },
    catalogue: CATALOGUE,
  } as unknown as IngestResult;
}

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
    blocks: [
      { id: "hero", block: { type: "hero", headline: "Made to be mended" } },
      { id: "grid", block: { type: "productGrid", layout: "grid", products: [{ handle: "oat-crew" }] } },
    ],
    meta: { prompt, generatedAt: "2026-08-01T09:00:00.000Z", audience: "Knitwear video viewers" },
  });
}

const GENOME = {
  version: 1,
  storeUrl: "https://kelpandcotton.com",
  generatedAt: "2026-08-01T09:00:00.000Z",
  catalogueRead: GENOME_TELLTALE,
  products: [
    {
      handle: "oat-crew",
      problemSolved: GENOME_TELLTALE,
      audience: GENOME_TELLTALE,
      occasions: [],
      role: "hero",
      giftability: "high",
      complements: [],
      substitutes: [],
      confidence: "high",
      priceTier: "core",
      photography: { rating: "strong", imageCount: 1, dimensionsKnown: true, notes: [] },
    },
  ],
  priceBands: { entryBelow: null, coreBelow: null, premiumBelow: null, sampled: 1 },
  diagnostics: { provider: "fake", model: "fake", attempts: 1, rejected: [], warnings: [], enriched: 1, catalogueSize: 1 },
} as CatalogueGenome;

let dir: string;
let store: ShopStore;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "popuup-publish-"));
  store = createLocalStore({ dir });
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("publishShop", () => {
  it("gives a shop a URL derived from the brand", async () => {
    const result = await publishShop({ config: configFor(), ingest: ingestFor() }, { store, origin: "https://popuup.com" });

    expect(result.created).toBe(true);
    expect(result.shop.slug).toBe("kelp-and-cotton");
    expect(result.url).toBe("https://popuup.com/kelp-and-cotton");
    expect(result.shop.version).toBe(1);
    expect(result.shop.plan).toBe("free");
  });

  it("appends a version instead of overwriting one", async () => {
    // Step 6 keys funnel events to the version that served them, so an
    // overwrite would silently reattribute somebody's numbers. It also means a
    // merchant who regenerates and prefers the old shop has not lost it.
    const first = await publishShop({ config: configFor("v1 prompt"), ingest: ingestFor(), slug: "kelp" }, { store });
    const second = await publishShop({ config: configFor("v2 prompt"), ingest: ingestFor(), slug: "kelp" }, { store });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.shop.version).toBe(2);
    expect(second.shop.versionId).not.toBe(first.shop.versionId);
    expect(second.shop.config.meta.prompt).toBe("v2 prompt");
  });

  it("refuses a URL that belongs to another store", async () => {
    await publishShop({ config: configFor(), ingest: ingestFor("https://kelpandcotton.com"), slug: "kelp" }, { store });

    await expect(
      publishShop({ config: configFor(), ingest: ingestFor("https://someoneelse.com"), slug: "kelp" }, { store }),
    ).rejects.toMatchObject({ code: "slug-taken" });
  });

  it("refuses a bad URL rather than quietly correcting it", async () => {
    // Publishing "Summer Edit!" to `summer-edit` without saying so is how a
    // link ends up in a bio pointing somewhere the merchant never agreed to.
    await expect(
      publishShop({ config: configFor(), ingest: ingestFor(), slug: "Summer Edit!" }, { store }),
    ).rejects.toBeInstanceOf(PublishError);
    await expect(
      publishShop({ config: configFor(), ingest: ingestFor(), slug: "pricing" }, { store }),
    ).rejects.toMatchObject({ code: "bad-slug" });
  });

  it("keeps one store row across many shops", async () => {
    await publishShop({ config: configFor(), ingest: ingestFor(), slug: "shop-one" }, { store });
    await publishShop({ config: configFor(), ingest: ingestFor(), slug: "shop-two" }, { store });

    // One catalogue serving many shops is the mechanism behind "constantly
    // live": re-ingesting reaches every shop at once.
    const record = await store.findStoreByUrl("https://kelpandcotton.com");
    expect(record).not.toBeNull();
    expect((await store.listPublished()).map((s) => s.slug).sort()).toEqual(["shop-one", "shop-two"]);
  });

  it("does not blank a stored Genome when prices are re-ingested", async () => {
    await publishShop({ config: configFor(), ingest: ingestFor(), genome: GENOME, slug: "kelp" }, { store });
    // A later publish that never ran step 2 passes no genome at all.
    await publishShop({ config: configFor(), ingest: ingestFor(), slug: "kelp-two" }, { store });

    const record = await store.findStoreByUrl("https://kelpandcotton.com");
    expect(record!.genome).not.toBeNull();
  });
});

describe("the Genome does not survive the trip to a page", () => {
  it("is stored, and is absent from what a public URL returns", async () => {
    await publishShop({ config: configFor(), ingest: ingestFor(), genome: GENOME, slug: "kelp" }, { store });

    const record = await store.findStoreByUrl("https://kelpandcotton.com");
    expect(JSON.stringify(record)).toContain(GENOME_TELLTALE);

    // The type handed to the renderer has no field for it, which is the point:
    // this is enforced by construction rather than by a SELECT list somebody
    // has to keep correct.
    const published = await store.loadBySlug("kelp");
    expect(JSON.stringify(published)).not.toContain(GENOME_TELLTALE);
    expect("genome" in (published as object)).toBe(false);
  });
});

describe("the badge", () => {
  it("is on by default, so a forgotten plan does not give the tier away", () => {
    const html = renderToStaticMarkup(<Shop config={configFor()} catalogue={CATALOGUE} />);
    expect(html).toContain("Made with");
    expect(html).toContain("badge-mark");
  });

  it("comes off for pro, and nothing else about the page changes", () => {
    const free = renderToStaticMarkup(<Shop config={configFor()} catalogue={CATALOGUE} badge />);
    const pro = renderToStaticMarkup(<Shop config={configFor()} catalogue={CATALOGUE} badge={false} />);

    expect(pro).not.toContain("Made with");
    // The paid tier removes a badge; it does not buy a different renderer.
    expect(free.replace(/<a class="badge".*?<\/a>/s, "")).toBe(pro);
  });

  it("carries a per-shop UTM, because the install loop has to be measurable", () => {
    const html = renderToStaticMarkup(<Shop config={configFor()} catalogue={CATALOGUE} slug="kelp-and-cotton" />);
    expect(html).toContain("utm_source=shop");
    expect(html).toContain("utm_campaign=kelp-and-cotton");
  });

  it("claims nothing the page cannot back", () => {
    // The badge is the single most tempting place to write "always in sync".
    // Asserted against visible text rather than markup: `decoding="async"`
    // contains "sync", and a test that fails on an attribute is a test that
    // gets loosened until it stops catching the thing it was written for.
    const text = visibleText(renderToStaticMarkup(<Shop config={configFor()} catalogue={CATALOGUE} slug="kelp" />));

    for (const claim of ["sync", "live", "real-time", "automatic", "connected", "up to date"]) {
      expect(text, claim).not.toContain(claim);
    }
    // "Made with" is a claim about how the page was built, which is true.
    expect(text).toContain("made with popuup");
  });
});

/**
 * The words a shopper actually reads.
 *
 * Inline tags close up and everything else becomes a space, because that is how
 * the text reads: the badge's `pop<em>uu</em>p` is one word on the page, and a
 * naive strip turns it into "pop uu p" and quietly stops matching. Everything
 * else becomes a space, because separate elements read as separate words even
 * when the markup has no whitespace between them.
 */
const MID_WORD = /<\/?(?:em|strong|b|i|sub|sup)\b[^>]*>/gi;

function visibleText(html: string): string {
  return html
    .replace(MID_WORD, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
