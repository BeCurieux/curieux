import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import fixture from "../fixtures/bench-and-bolt.ingest.json";
import type { IngestResult } from "@/lib/ingest/types";
import { BriefError, extractPriceCap, PopBrief, unenforceable } from "@/lib/pop/brief";
import { createAnthropicBriefParser, createMockBriefParser, finaliseBrief, type BriefDraft } from "@/lib/pop/parse";
import { hardFilter, resolveMentions } from "@/lib/pop/filter";
import { AUDIENCE_MISMATCH, scoreCandidates, shortlist } from "@/lib/pop/score";
import { guardPop, handlesIn, variantsIn } from "@/lib/pop/guard";
import { generatePop } from "@/lib/pop/engine";
import { classifyCatalogue } from "@/lib/genome/v1/classify";
import { createMockClassifier } from "@/lib/genome/v1/mock";
import type { GenomeValue } from "@/lib/genome/v1/records";
import type { ShopConfig } from "@/lib/schema";
import { createMockProvider } from "@/lib/merchandise/index";

const ingest = fixture as unknown as IngestResult;
const SENTENCE = "Make a Father's Day shop for dads who boat. Under $120.";

async function brief(sentence = SENTENCE, patch: (b: PopBrief) => PopBrief = (b) => b): Promise<PopBrief> {
  return patch(finaliseBrief(sentence, await createMockBriefParser().parse(sentence)));
}

describe("price caps are read by code", () => {
  it.each([
    ["Under $120.", 120, "per_item"],
    ["gifts below £80 for mum", 80, "per_item"],
    ["everything $50 or less", 50, "per_item"],
    ["up to A$1,200 each", 1200, "per_item"],
    ["a gift box under $150 in total", 150, "basket"],
    ["no more than 99.95", 99.95, "per_item"],
  ])("%s", (sentence, amount, scope) => {
    expect(extractPriceCap(sentence)).toMatchObject({ amount, scope });
  });

  it.each(["up to 5 products for dad", "ships within 3 days", "a Father's Day shop", "under 10 items"])("finds no price in %s", (sentence) => {
    expect(extractPriceCap(sentence)).toBeNull();
  });

  it("binds the pattern over the model, and refuses when they disagree", () => {
    const draft = (priceMax: number | null): BriefDraft => ({
      persona: "dads who boat", campaign: "Father's Day", goal: "conversion", priceMax, priceScope: "per_item",
      minUnits: null, shipBy: null, marginMin: null, mentions: [],
      targets: { occasion_fit: ["fathers_day"], audience_fit: ["men"], use_context: ["water_coastal"], gift_role: [], seasonality: [], item_type: [], style_register: [] },
    });
    expect(finaliseBrief(SENTENCE, draft(null)).ruleSource.priceMax).toBe("pattern");
    expect(finaliseBrief(SENTENCE, draft(120)).ruleSource.priceMax).toBe("pattern+model");
    expect(() => finaliseBrief(SENTENCE, draft(12))).toThrow(/Edit the brief/);
    const modelOnly = finaliseBrief("Dad gifts, a hundred and twenty dollars tops", draft(120));
    expect(modelOnly.ruleSource.priceMax).toBe("model");
    expect(unenforceable(modelOnly, { hasUnits: false, hasCost: false }).join()).toMatch(/confirm it/);
  });

  it("refuses rules the public path cannot keep, instead of ignoring them", async () => {
    const b = await brief(SENTENCE, (x) => ({ ...x, rules: { ...x.rules, marginMin: 0.5, minUnits: 10 } }));
    expect(unenforceable(b, { hasUnits: false, hasCost: false })).toHaveLength(2);
    expect(unenforceable(b, { hasUnits: true, hasCost: true })).toHaveLength(0);
  });
});

describe("the hard filter", () => {
  it("keeps only buyable products under the cap", async () => {
    const { candidates, excluded } = hardFilter(ingest.catalogue, await brief());
    expect(candidates.map((c) => c.product.handle).sort()).toEqual([
      "mens-heavy-duty-leather-work-gloves",
      "mens-heavy-duty-tactical-tool-belt",
      "professional-108-piece-socket-wrench-set",
      "self-leveling-cross-line-laser-level-kit",
    ]);
    expect(excluded.find((e) => e.handle === "4-5-heavy-duty-angle-grinder-850w")!.reason).toBe("sold out");
    expect(excluded.find((e) => e.handle === "heavy-duty-cordless-drill-20v")!.reason).toMatch(/no buyable variant at or under 120/);
  });

  it("pins a product whose variants straddle the cap to one under it", async () => {
    const shirt = structuredClone(ingest.catalogue.products[1]!);
    shirt.handle = "shirt";
    shirt.variants = [
      { ...shirt.variants[0]!, id: "big", price: 140, available: true },
      { ...shirt.variants[0]!, id: "small", price: 95, available: true },
    ];
    const { candidates } = hardFilter({ ...ingest.catalogue, products: [shirt] }, await brief());
    expect(candidates[0]).toMatchObject({ pinnedVariantId: "small", price: 95 });
  });

  it("reports a lock that breaks a rule rather than dropping it quietly", async () => {
    const b = await brief(SENTENCE, (x) => ({ ...x, rules: { ...x.rules, includeHandles: ["heavy-duty-cordless-drill-20v", "nope"] } }));
    expect(hardFilter(ingest.catalogue, b).conflicts).toHaveLength(2);
  });

  it("resolves a named product only when exactly one title matches", () => {
    const r = resolveMentions(["the laser level", "gloves", "the tool"], ingest.catalogue);
    expect(r.handles).toEqual(["self-leveling-cross-line-laser-level-kit", "mens-heavy-duty-leather-work-gloves"]);
    expect(r.unresolved).toEqual(["the tool"]);
  });
});

async function genome(): Promise<GenomeValue[]> {
  const r = await classifyCatalogue({ storeUrl: ingest.store.storeUrl, catalogue: ingest.catalogue, provider: createMockClassifier() });
  return r.values;
}

const value = (handle: string, dimension: GenomeValue["dimension"], v: string, confidence: number, provenance: GenomeValue["provenance"] = "taxonomy_model"): GenomeValue => ({
  storeUrl: ingest.store.storeUrl, handle, dimension, value: v, layer: "global", taxonomyVersion: "genome_taxonomy_v1", provenance,
  confidence, evidenceState: null, rawValue: null, comparisonScope: null, comparisonN: null, percentile: null,
  derivedAt: "x", inputsHash: "h", runAgreement: `${Math.round(confidence * 5)}/5`, model: "m", promptVersion: "p",
});

describe("scoring", () => {
  it("weights concept matches by measured confidence, and ranks deterministically", async () => {
    const b = await brief();
    const { candidates } = hardFilter(ingest.catalogue, b);
    const values = [
      value("mens-heavy-duty-leather-work-gloves", "occasion_fit", "fathers_day", 1),
      value("self-leveling-cross-line-laser-level-kit", "occasion_fit", "fathers_day", 0.6),
      value("mens-heavy-duty-tactical-tool-belt", "audience_fit", "women", 1),
    ];
    const ranked = scoreCandidates(candidates, b, values);
    expect(ranked[0]!.candidate.product.handle).toBe("mens-heavy-duty-leather-work-gloves");
    expect(ranked[0]!.matched).toEqual(["occasion_fit:fathers_day (5/5)"]);
    const laser = ranked.find((r) => r.candidate.product.handle === "self-leveling-cross-line-laser-level-kit")!;
    expect(laser.score).toBeCloseTo(3 * 0.6);
    const belt = ranked.find((r) => r.candidate.product.handle === "mens-heavy-duty-tactical-tool-belt")!;
    expect(belt.score).toBe(AUDIENCE_MISMATCH);
    expect(ranked.at(-1)).toBe(belt);
  });

  it("lets a merchant declaration override the model before scoring", async () => {
    const b = await brief();
    const { candidates } = hardFilter(ingest.catalogue, b);
    const values = [
      value("mens-heavy-duty-tactical-tool-belt", "audience_fit", "women", 1),
      value("mens-heavy-duty-tactical-tool-belt", "audience_fit", "men", 1, "merchant_declared"),
    ];
    const belt = scoreCandidates(candidates, b, values).find((r) => r.candidate.product.handle === "mens-heavy-duty-tactical-tool-belt")!;
    expect(belt.score).toBeGreaterThan(0);
  });

  it("always keeps locks in the shortlist", async () => {
    const b = await brief(SENTENCE, (x) => ({ ...x, rules: { ...x.rules, includeHandles: ["mens-heavy-duty-tactical-tool-belt"] } }));
    const ranked = scoreCandidates(hardFilter(ingest.catalogue, b).candidates, b, []);
    expect(shortlist(ranked, 1).map((s) => s.candidate.product.handle)).toEqual(["mens-heavy-duty-tactical-tool-belt"]);
  });
});

describe("the guard", () => {
  const base = (products: { handle: string; variantId?: string }[]): ShopConfig => ({
    version: 1,
    brand: { name: "B", storeUrl: "https://bench-and-bolt.myshopify.com/" },
    theme: { colorway: { background: "#fff", surface: "#fff", text: "#000", accent: "#000" }, typography: "modern-sans", mood: "clean", density: "regular", cornerRadius: "soft" },
    blocks: [
      { id: "hero", block: { type: "hero", headline: "For dad", media: { kind: "productImage", handle: "heavy-duty-cordless-drill-20v", imageIndex: 0 } } },
      { id: "grid", block: { type: "productGrid", products, layout: "grid" } },
    ],
    meta: { prompt: SENTENCE, generatedAt: "2026-09-26T00:00:00.000Z" },
  });

  it("removes anything off the shortlist, adds missing locks, and says so", async () => {
    const b = await brief(SENTENCE, (x) => ({ ...x, rules: { ...x.rules, includeHandles: ["mens-heavy-duty-tactical-tool-belt"] } }));
    const list = scoreCandidates(hardFilter(ingest.catalogue, b).candidates, b, []);
    const g = guardPop(base([{ handle: "professional-108-piece-socket-wrench-set" }, { handle: "7-drawer-mechanics-tool-chest" }]), b, list);
    expect(handlesIn(g.config)).toEqual(["mens-heavy-duty-tactical-tool-belt", "professional-108-piece-socket-wrench-set"]);
    expect(g.repairs.join(" ")).toMatch(/hero image of "heavy-duty-cordless-drill-20v" removed/);
    expect(g.repairs.join(" ")).toMatch(/removed "7-drawer-mechanics-tool-chest"/);
    expect(g.added.has("mens-heavy-duty-tactical-tool-belt")).toBe(true);
  });

  it("re-pins a variant that breaks the cap", async () => {
    const shirt = structuredClone(ingest.catalogue.products[1]!);
    shirt.handle = "shirt";
    shirt.variants = [
      { ...shirt.variants[0]!, id: "big", price: 140, available: true },
      { ...shirt.variants[0]!, id: "small", price: 95, available: true },
    ];
    const b = await brief();
    const list = scoreCandidates(hardFilter({ ...ingest.catalogue, products: [shirt] }, b).candidates, b, []);
    expect(variantsIn(guardPop(base([{ handle: "shirt", variantId: "big" }]), b, list).config).get("shirt")).toBe("small");
    expect(variantsIn(guardPop(base([{ handle: "shirt" }]), b, list).config).get("shirt")).toBe("small");
  });
});

describe("generatePop — the demo acceptance test, on the dev-store fixture", () => {
  it(`"${SENTENCE}" produces a POP where every item is ≤ $120 and in stock, with every decision logged`, async () => {
    const result = await generatePop({ ingest, brief: await brief(), genome: await genome(), provider: createMockProvider(), shortlistSize: 24, now: () => new Date("2026-09-26T00:00:00Z") });
    const shown = handlesIn(result.config);
    expect(shown.length).toBeGreaterThan(0);
    const pinned = variantsIn(result.config);
    for (const handle of shown) {
      const product = ingest.catalogue.products.find((p) => p.handle === handle)!;
      const variant = pinned.get(handle) ? product.variants.find((v) => v.id === pinned.get(handle)) : undefined;
      const price = variant ? variant.price : product.price.max;
      expect(price, handle).toBeLessThanOrEqual(120);
      expect(product.available, handle).toBe(true);
    }
    expect(result.config.meta.prompt).toBe(SENTENCE);
    expect(result.decisions.map((d) => d.handle)).toEqual(shown);
    expect(result.decisions.filter((d) => d.role === "hero")).toHaveLength(1);
    expect(result.decisions.every((d) => d.isExploration === false)).toBe(true);
  });

  it("refuses a brief nothing can satisfy, before spending anything on a model", async () => {
    const b = await brief("Father's Day under $5");
    await expect(generatePop({ ingest, brief: b, genome: [], provider: createMockProvider() })).rejects.toBeInstanceOf(BriefError);
  });
});

describe("the Anthropic brief parser", () => {
  it("asks for enum-constrained JSON and returns a draft the code then settles", async () => {
    let request: Anthropic.MessageCreateParamsNonStreaming | undefined;
    const client = {
      messages: {
        create: async (body: Anthropic.MessageCreateParamsNonStreaming) => {
          request = body;
          return {
            stop_reason: "end_turn",
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  persona: "dads who boat", campaign: "Father's Day", goal: "conversion", price_max: 120, price_scope: "per_item",
                  min_units: null, ship_by: null, margin_min: null, mentions: [],
                  occasion_fit: ["fathers_day"], audience_fit: ["men"], use_context: ["water_coastal"], gift_role: ["practical"],
                  seasonality: [], item_type: [], style_register: [],
                }),
              },
            ],
          };
        },
      },
    } as unknown as Anthropic;
    const draft = await createAnthropicBriefParser({ client }).parse(SENTENCE);
    expect(request!.output_config!.format!.type).toBe("json_schema");
    const settled = finaliseBrief(SENTENCE, draft);
    expect(settled.rules.priceMax).toBe(120);
    expect(settled.who.audienceFit).toEqual(["men"]);
    expect(settled.targets.use_context).toEqual(["water_coastal"]);
  });
});
