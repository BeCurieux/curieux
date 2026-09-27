import { describe, expect, it } from "vitest";
import fixture from "../fixtures/bench-and-bolt.ingest.json";
import type { Catalogue, IngestedProduct, IngestResult } from "@/lib/ingest/types";
import type { ShopConfig } from "@/lib/schema";
import type { GenomeValue } from "@/lib/genome/v1/records";
import { finaliseBrief, createMockBriefParser } from "@/lib/pop/parse";
import { enforceListingTruth } from "@/lib/pop/honesty";
import { collectionBaseline, collectionTerms, describeBaseline } from "@/lib/pop/baseline";
import { catalogueVerdict, niceCap, suggestPops } from "@/lib/pop/suggest";
import { extractPriceCap } from "@/lib/pop/brief";

const ingest = fixture as unknown as IngestResult;
const SENTENCE = "Make a Father's Day shop for dads who boat. Under $120.";
const brief = async (sentence = SENTENCE) => finaliseBrief(sentence, await createMockBriefParser().parse(sentence));
const byHandle = new Map(ingest.catalogue.products.map((p) => [p.handle, p]));

const config = (products: { handle: string; blurb?: string }[]): ShopConfig => ({
  version: 1,
  brand: { name: "B", storeUrl: "https://bench-and-bolt.myshopify.com/" },
  theme: { colorway: { background: "#fff", surface: "#fff", text: "#000", accent: "#000" }, typography: "modern-sans", mood: "clean", density: "regular", cornerRadius: "soft" },
  blocks: [
    { id: "hero", block: { type: "hero", headline: "For the dad who fixes it dockside" } },
    { id: "grid", block: { type: "productGrid", products, layout: "grid" } },
  ],
  meta: { prompt: SENTENCE, generatedAt: "2026-09-27T00:00:00.000Z" },
});

describe("product copy only claims what the listing says", () => {
  it("removes the blurbs the first real POP invented, and keeps the honest one", async () => {
    const result = enforceListingTruth(
      config([
        { handle: "mens-heavy-duty-leather-work-gloves", blurb: "Grip for wet lines and rusted bolts, with fingertips that still work a screen." },
        { handle: "professional-108-piece-socket-wrench-set", blurb: "SAE and metric in one case — covers engine, trailer and deck hardware." },
        { handle: "mens-heavy-duty-tactical-tool-belt", blurb: "Full-grain leather, eleven pockets: everything to hand while he works." },
      ]),
      await brief(),
      byHandle,
    );
    const grid = result.config.blocks[1]!.block;
    if (grid.type !== "productGrid") throw new Error("grid expected");
    expect(grid.products.map((p) => Boolean(p.blurb))).toEqual([false, false, true]);
    expect(result.repairs.join(" ")).toMatch(/"wet"/);
    expect(result.repairs.join(" ")).toMatch(/"deck/);
    // The hero is page framing for the audience, and is left alone.
    expect(result.config.blocks[0]!.block).toMatchObject({ headline: "For the dad who fixes it dockside" });
  });

  it("does not trip on words that merely start the same way", async () => {
    const result = enforceListingTruth(config([{ handle: "mens-heavy-duty-leather-work-gloves", blurb: "A season-round glove." }]), await brief(), byHandle);
    expect(result.repairs).toEqual([]);
  });

  it("allows a claim the listing does make", async () => {
    const glove: IngestedProduct = { ...byHandle.get("mens-heavy-duty-leather-work-gloves")!, description: "Grippy even on wet boat lines." };
    const result = enforceListingTruth(config([{ handle: glove.handle, blurb: "Grip for wet lines." }]), await brief(), new Map([[glove.handle, glove]]));
    expect(result.repairs).toEqual([]);
  });
});

describe("the collection baseline", () => {
  it("builds the smart collection a merchant would, audience words included", async () => {
    const terms = collectionTerms(await brief());
    expect(terms).toEqual(expect.arrayContaining(["father", "dads", "boat", "mens", "him"]));
    expect(terms).not.toContain("shop");
  });

  it("says plainly when a POP is a collection with a nicer header", async () => {
    const pop = ["professional-108-piece-socket-wrench-set", "mens-heavy-duty-tactical-tool-belt", "mens-heavy-duty-leather-work-gloves"];
    const b = collectionBaseline(ingest.catalogue, await brief(), pop);
    expect(b.overlapShare).toBe(1);
    expect(b.popOnly).toEqual([]);
    expect(describeBaseline(b)).toMatch(/collection with a nicer header/);
  });

  it("counts as Genome-only only what no keyword reaches, however the collection is cut", async () => {
    const b = collectionBaseline(ingest.catalogue, await brief("Father's Day for dads under $150"), ["mens-heavy-duty-tactical-tool-belt"]);
    expect(b.popOnly).toEqual([]);
  });
});

/** A gift catalogue where the Genome knows more than the titles say. */
function giftCatalogue(): { catalogue: Catalogue; genome: GenomeValue[] } {
  const base = ingest.catalogue.products[1]!;
  const make = (handle: string, title: string, price: number): IngestedProduct => ({
    ...base,
    handle,
    title,
    tags: [],
    productType: "Gifts",
    description: title,
    variants: [{ ...base.variants[0]!, id: handle, price, available: true }],
    price: { min: price, max: price },
    available: true,
    availabilityKnown: true,
  });
  const products = [
    make("canvas-cap", "Canvas Cap", 35),
    make("linen-shirt", "Navy Linen Shirt", 89),
    make("deck-shoes", "Leather Deck Shoes", 110),
    make("flask", "Steel Hip Flask", 45),
    make("wallet", "Slim Wallet", 60),
    make("socks", "Merino Socks", 25),
    make("dad-mug", "World's Best Dad Mug", 20),
    make("scarf", "Silk Scarf", 70),
  ];
  const v = (handle: string, dimension: GenomeValue["dimension"], value: string): GenomeValue => ({
    storeUrl: "s", handle, dimension, value, layer: "global", taxonomyVersion: "genome_taxonomy_v1", provenance: "taxonomy_model",
    confidence: 1, evidenceState: null, rawValue: null, comparisonScope: null, comparisonN: null, percentile: null,
    derivedAt: "x", inputsHash: "h", runAgreement: "5/5", model: "m", promptVersion: "p",
  });
  const genome: GenomeValue[] = [];
  for (const p of products.filter((x) => x.handle !== "scarf")) genome.push(v(p.handle, "occasion_fit", "fathers_day"), v(p.handle, "audience_fit", "men"));
  for (const h of ["canvas-cap", "linen-shirt", "deck-shoes"]) genome.push(v(h, "use_context", "water_coastal"));
  genome.push(v("scarf", "occasion_fit", "mothers_day"), v("scarf", "audience_fit", "women"));
  return { catalogue: { currency: "AUD", products, productCount: products.length, truncated: false }, genome };
}

describe("suggestions", () => {
  it("proposes the POPs the catalogue has depth for, ranked by what keywords would miss", () => {
    const { catalogue, genome } = giftCatalogue();
    const suggestions = suggestPops(catalogue, genome, { minProducts: 3 });
    const top = suggestions[0]!;
    expect(top.sentence).toBe("Make a Father's Day shop for dads. Under $100.");
    expect(top.genomeOnly).not.toContain("dad-mug");
    expect(top.genomeOnly.length).toBeGreaterThanOrEqual(5);
    expect(suggestions.map((s) => s.sentence)).toContain("Make a Father's Day shop for dads who love the water. Under $120.");
    // Mother's Day has one product: not enough depth to suggest.
    expect(suggestions.some((s) => s.sentence.includes("Mother's Day"))).toBe(false);
  });

  it("writes a brief whose rules the pattern agrees with", () => {
    const { catalogue, genome } = giftCatalogue();
    for (const s of suggestPops(catalogue, genome, { minProducts: 3 })) {
      expect(extractPriceCap(s.sentence)?.amount ?? null).toBe(s.brief.rules.priceMax);
      expect(s.handles.every((h) => catalogue.products.find((p) => p.handle === h)!.price.min <= (s.priceCap ?? Infinity))).toBe(true);
    }
  });

  it("reads a catalogue for the kill test", () => {
    const { catalogue, genome } = giftCatalogue();
    expect(catalogueVerdict(suggestPops(catalogue, genome, { minProducts: 3 })).genomeLed).toBeGreaterThan(0);
    expect(catalogueVerdict([]).verdict).toBe("skip");
  });

  it("picks a round cap that keeps most of the range", () => {
    expect(niceCap([20, 35, 45, 60, 89, 110], 3)).toBe(100);
    expect(niceCap([900, 950], 2)).toBeNull();
  });
});
