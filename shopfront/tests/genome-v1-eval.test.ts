import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import fixture from "../fixtures/bench-and-bolt.ingest.json";
import type { IngestResult } from "@/lib/ingest/types";
import { adjudicatedGold, agreement, cohensKappa, labelShifts, scoreModel, verdictFor } from "@/lib/genome/v1/eval";
import {
  completedItems,
  goldCatalogue,
  hashToken,
  LabelError,
  newInviteToken,
  nextItem,
  plausibleToken,
  sampleGoldSet,
  validateLabel,
} from "@/lib/genome/v1/gold";
import { createLocalGenomeV1Store, type GoldLabel } from "@/lib/genome/v1/store";
import { classifyCatalogue } from "@/lib/genome/v1/classify";
import { createMockClassifier } from "@/lib/genome/v1/mock";
import { MODEL_DIMENSIONS, TAXONOMY_VERSION } from "@/lib/genome/v1/taxonomy";
import type { GenomeValue } from "@/lib/genome/v1/records";

const ingest = fixture as unknown as IngestResult;
const V = TAXONOMY_VERSION;

describe("Cohen's kappa", () => {
  it("matches the textbook example: 50 items, 70% observed, 50% chance → 0.4", () => {
    const pairs: [string, string][] = [
      ...Array(20).fill(["yes", "yes"]),
      ...Array(5).fill(["yes", "no"]),
      ...Array(10).fill(["no", "yes"]),
      ...Array(15).fill(["no", "no"]),
    ];
    expect(cohensKappa(pairs)).toBeCloseTo(0.4, 10);
  });

  it("is 1 for perfect agreement across categories, and undefined when chance agreement is total", () => {
    expect(cohensKappa([["a", "a"], ["b", "b"], ["c", "c"]])).toBe(1);
    expect(cohensKappa([["a", "a"], ["a", "a"]])).toBeNull();
    expect(cohensKappa([])).toBeNull();
  });

  it("maps to the handoff's gate, and refuses a verdict on too few items", () => {
    expect(verdictFor(0.6, 50, 30)).toBe("keep");
    expect(verdictFor(0.59, 50, 30)).toBe("tighten");
    expect(verdictFor(0.39, 50, 30)).toBe("redefine");
    expect(verdictFor(0.9, 10, 30)).toBe("insufficient");
    expect(verdictFor(null, 50, 30)).toBe("insufficient");
  });
});

const label = (itemId: string, labellerId: string, dimension: string, labels: string[]): GoldLabel => ({
  itemId,
  labellerId,
  dimension: dimension as GoldLabel["dimension"],
  labels,
  taxonomyVersion: V,
  labelledAt: "2026-09-26T00:00:00Z",
});

describe("agreement between two labellers", () => {
  const labels: GoldLabel[] = [];
  const gifts = ["practical", "indulgent", "novelty", "practical"];
  for (let i = 0; i < 40; i++) {
    const g = gifts[i % 4]!;
    labels.push(label(`i${i}`, "A", "gift_role", [g]));
    labels.push(label(`i${i}`, "B", "gift_role", [i % 10 === 0 ? "not_giftable" : g]));
    labels.push(label(`i${i}`, "A", "occasion_fit", i % 2 ? ["everyday", "fathers_day"] : ["everyday"]));
    labels.push(label(`i${i}`, "B", "occasion_fit", i % 2 ? ["fathers_day", "everyday"] : ["everyday"]));
  }

  it("scores single-label dimensions directly and multi-label ones per value", () => {
    const rows = agreement(labels, "A", "B", V);
    const gift = rows.find((r) => r.dimension === "gift_role")!;
    expect(gift.items).toBe(40);
    expect(gift.observed).toBeCloseTo(0.9);
    expect(gift.verdict).toBe("keep");
    const occasion = rows.find((r) => r.dimension === "occasion_fit")!;
    // Order does not matter; the sets are the same.
    expect(occasion.observed).toBe(1);
    expect(occasion.perValue!.fathers_day).toBe(1);
    // everyday is on every item for both: kappa undefined, and left out of the mean.
    expect(occasion.perValue!.everyday).toBeNull();
    expect(occasion.kappa).toBe(1);
    expect(rows.find((r) => r.dimension === "seasonality")!.verdict).toBe("insufficient");
  });

  it("builds gold from agreement, then the adjudicator, and never guesses the rest", () => {
    const withAdj = [...labels, label("i0", "C", "gift_role", ["practical"])];
    const gold = adjudicatedGold(withAdj, "A", "B", V, "C");
    expect(gold.adjudicated).toBe(1);
    expect(gold.unresolved).toBe(3);
    expect(gold.answers.get("i0")!.get("gift_role")).toEqual(["practical"]);
    expect(gold.answers.get("i10")?.get("gift_role")).toBeUndefined();
  });

  it("scores the model against gold with calibration buckets", () => {
    const gold = adjudicatedGold(labels, "A", "B", V);
    const withGift = [...gold.answers.keys()].filter((item) => gold.answers.get(item)!.get("gift_role"));
    const model: GenomeValue[] = withGift.map((item, i) => ({
      storeUrl: "gold",
      handle: item,
      dimension: "gift_role",
      value: i % 3 === 0 ? "novelty" : gold.answers.get(item)!.get("gift_role")![0]!,
      layer: "global",
      taxonomyVersion: V,
      provenance: "taxonomy_model",
      confidence: i % 3 === 0 ? 0.6 : 1,
      evidenceState: null,
      rawValue: null,
      comparisonScope: null,
      comparisonN: null,
      percentile: null,
      derivedAt: "x",
      inputsHash: "h",
      runAgreement: null,
      model: "m",
      promptVersion: "p",
    }));
    const score = scoreModel(gold, model).find((s) => s.dimension === "gift_role")!;
    expect(score.items).toBe(withGift.length);
    expect(withGift.length).toBe(36);
    expect(score.calibration["5/5"]!.accuracy).toBe(1);
    expect(score.calibration["3/5 or less"]!.items).toBeGreaterThan(0);
    expect(score.consistency).toBeLessThan(1);
  });
});

describe("label shifts", () => {
  const row = (handle: string, value: string, promptVersion = "p1"): GenomeValue => ({
    storeUrl: "s", handle, dimension: "gift_role", value, layer: "global", taxonomyVersion: V, provenance: "taxonomy_model",
    confidence: 1, evidenceState: null, rawValue: null, comparisonScope: null, comparisonN: null, percentile: null,
    derivedAt: "x", inputsHash: "h", runAgreement: "5/5", model: "m", promptVersion,
  });

  it("flags a change with the same model and prompt as silent, and an explained one as not", () => {
    const silent = labelShifts([row("a", "practical")], [row("a", "novelty")]).find((s) => s.dimension === "gift_role")!;
    expect(silent).toMatchObject({ changed: 1, compared: 1, silent: true });
    const explained = labelShifts([row("a", "practical")], [row("a", "novelty", "p2")]).find((s) => s.dimension === "gift_role")!;
    expect(explained.silent).toBe(false);
  });
});

describe("the gold set", () => {
  it("samples an even share per store, round-robin across categories, reproducibly", () => {
    const sources = ["https://a.example", "https://b.example"].map((storeUrl) => ({ storeUrl, catalogue: ingest.catalogue }));
    const one = sampleGoldSet(sources, { goldSet: "g1", size: 6, seed: 7 });
    const two = sampleGoldSet(sources, { goldSet: "g1", size: 6, seed: 7 });
    expect(one.items).toHaveLength(6);
    expect(one.items.map((i) => i.handle)).toEqual(two.items.map((i) => i.handle));
    expect(one.items.filter((i) => i.storeUrl === "https://a.example")).toHaveLength(3);
    const types = new Set(one.items.filter((i) => i.storeUrl === "https://a.example").map((i) => i.snapshot.productType));
    expect(types.size).toBeGreaterThan(1);
    expect(one.warnings.join(" ")).toContain("at least 8");
  });

  it("round-trips a snapshot into something the classifier reads", () => {
    const [item] = sampleGoldSet([{ storeUrl: "https://a.example", catalogue: ingest.catalogue }], { goldSet: "g", size: 1 }).items;
    const catalogue = goldCatalogue([{ ...item!, id: "item-1", createdAt: "x" }]);
    expect(catalogue.products[0]).toMatchObject({ handle: "item-1", title: item!.snapshot.title });
  });

  it("issues invite tokens that are only ever stored hashed", () => {
    const token = newInviteToken();
    expect(plausibleToken(token)).toBe(true);
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).not.toContain(token);
    expect(plausibleToken("../../etc/passwd")).toBe(false);
  });

  it("validates a label against the taxonomy", () => {
    expect(validateLabel("use_context", ["home", "travel"]).labels).toEqual(["home", "travel"]);
    expect(() => validateLabel("use_context", ["home", "travel", "work", "fitness"])).toThrow(LabelError);
    expect(() => validateLabel("gift_role", ["practical", "novelty"])).toThrow(LabelError);
    expect(() => validateLabel("gift_role", [])).toThrow(LabelError);
    expect(() => validateLabel("price_band", ["mid"])).toThrow(LabelError);
    expect(() => validateLabel("audience_fit", ["men", "unknown"])).toThrow(LabelError);
  });
});

describe("the local Genome v1 store", () => {
  const tmp = async () => path.join(await mkdtemp(path.join(os.tmpdir(), "gv1-")), "db.json");

  it("never lets a reclassification overwrite a merchant's declaration", async () => {
    const store = createLocalGenomeV1Store(await tmp());
    const storeUrl = ingest.store.storeUrl;
    const first = await classifyCatalogue({ storeUrl, catalogue: ingest.catalogue, provider: createMockClassifier() });
    await store.saveClassification(storeUrl, first.products, first.values);
    const handle = ingest.catalogue.products[0]!.handle;
    const declared: GenomeValue = { ...first.values.find((v) => v.handle === handle && v.dimension === "gift_role")!, value: "indulgent", provenance: "merchant_declared" };
    await store.saveDeclaration(storeUrl, handle, "gift_role", [declared]);

    const again = await classifyCatalogue({ storeUrl, catalogue: ingest.catalogue, provider: createMockClassifier() });
    await store.saveClassification(storeUrl, again.products, again.values);
    const loaded = await store.loadClassification(storeUrl);
    expect(loaded.values.filter((v) => v.handle === handle && v.provenance === "merchant_declared")).toHaveLength(1);
    expect(loaded.values.filter((v) => v.handle === handle && v.dimension === "gift_role" && v.provenance === "taxonomy_model")).toHaveLength(1);
  });

  it("finds a labeller by token hash, tracks what they finished, and upserts a relabel", async () => {
    const store = createLocalGenomeV1Store(await tmp());
    const token = newInviteToken();
    const labeller = await store.createLabeller("Merchandiser A", hashToken(token));
    expect(await store.findLabeller(hashToken(token))).toMatchObject({ id: labeller.id });
    expect(await store.findLabeller(hashToken("wrong"))).toBeNull();

    const sample = sampleGoldSet([{ storeUrl: "https://a.example", catalogue: ingest.catalogue }], { goldSet: "g", size: 2 });
    const items = await store.addGoldItems(sample.items);
    expect(await store.addGoldItems(sample.items)).toHaveLength(2);
    expect(await store.listGoldItems("g")).toHaveLength(2);

    for (const dim of MODEL_DIMENSIONS) {
      await store.saveLabel(label(items[0]!.id, labeller.id, dim, ["unknown"]));
    }
    await store.saveLabel(label(items[0]!.id, labeller.id, "gift_role", ["practical"]));
    const labels = await store.listLabels({ labellerId: labeller.id });
    expect(labels.filter((l) => l.dimension === "gift_role")).toMatchObject([{ labels: ["practical"] }]);
    const done = completedItems(labels, labeller.id, V);
    expect(done.has(items[0]!.id)).toBe(true);
    expect(nextItem(items, done)!.id).toBe(items[1]!.id);
  });
});
