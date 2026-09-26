import { describe, expect, it } from "vitest";
import { consensus, consensusCategory } from "@/lib/genome/v1/consensus";
import { crossMerchantEligible, resolve, type GenomeValue } from "@/lib/genome/v1/records";
import { declare, OverrideError } from "@/lib/genome/v1/overrides";

describe("consensus over five runs", () => {
  it("takes the modal single value with its measured share", () => {
    const runs = ["practical", "practical", "practical", "practical", "indulgent"].map((gift_role) => ({ gift_role }));
    expect(consensus("gift_role", runs)).toEqual([{ value: "practical", confidence: 0.8, agreement: "4/5", distribution: "practical:4 indulgent:1" }]);
  });

  it("answers unknown, with no confidence, when the top is tied", () => {
    const runs = ["practical", "practical", "indulgent", "indulgent", "novelty"].map((gift_role) => ({ gift_role }));
    const [c] = consensus("gift_role", runs);
    expect(c).toMatchObject({ value: "unknown", confidence: null });
  });

  it("keeps multi-label values named by a majority, each with its own share", () => {
    const runs = [
      { occasion_fit: ["fathers_day", "summer_travel"] },
      { occasion_fit: ["fathers_day", "summer_travel"] },
      { occasion_fit: ["fathers_day"] },
      { occasion_fit: ["fathers_day", "birthday"] },
      { occasion_fit: ["summer_travel", "fathers_day"] },
    ];
    expect(consensus("occasion_fit", runs).map((c) => [c.value, c.confidence])).toEqual([
      ["fathers_day", 1],
      ["summer_travel", 0.6],
    ]);
  });

  it("caps use_context at three by count", () => {
    const all = ["home", "outdoor", "travel", "work"];
    const runs = Array.from({ length: 5 }, () => ({ use_context: all }));
    expect(consensus("use_context", runs)).toHaveLength(3);
  });

  it("returns unknown when no value reaches a majority, confident only if unknown itself did", () => {
    const split = [{ audience_fit: ["men"] }, { audience_fit: ["women"] }, { audience_fit: ["unisex_adult"] }, { audience_fit: ["men"] }, { audience_fit: ["women"] }];
    expect(consensus("audience_fit", split)).toMatchObject([{ value: "unknown", confidence: null }]);
    const agreed = Array.from({ length: 4 }, () => ({ audience_fit: ["unknown"] })).concat([{ audience_fit: ["men"] }]);
    expect(consensus("audience_fit", agreed)).toMatchObject([{ value: "unknown", confidence: 0.8 }]);
  });

  it("measures against the runs that exist, and says when there were none", () => {
    expect(consensus("gift_role", [])).toMatchObject([{ value: "unknown", confidence: null, agreement: "0/0" }]);
    expect(consensusCategory([{ parent_category: "apparel" }, { parent_category: "apparel" }, { parent_category: "other" }])).toBe("apparel");
    expect(consensusCategory([{ parent_category: "apparel" }, { parent_category: "other" }])).toBeNull();
  });
});

const base: GenomeValue = {
  storeUrl: "https://example.com",
  handle: "shirt",
  dimension: "audience_fit",
  value: "women",
  layer: "global",
  taxonomyVersion: "genome_taxonomy_v1",
  provenance: "taxonomy_model",
  confidence: 1,
  evidenceState: null,
  rawValue: null,
  comparisonScope: null,
  comparisonN: null,
  percentile: null,
  derivedAt: "2026-09-26T00:00:00.000Z",
  inputsHash: "x",
  runAgreement: "5/5",
  model: "m",
  promptVersion: "p",
};

describe("precedence", () => {
  it("lets a merchant declaration replace the whole dimension, not just one value", () => {
    const model = [base, { ...base, value: "unisex_adult" }];
    const declared = declare({
      storeUrl: base.storeUrl,
      handle: "shirt",
      dimension: "audience_fit",
      values: ["men"],
      catalogueHandles: new Set(["shirt"]),
    });
    const resolved = resolve([...model, ...declared]);
    expect(resolved.map((v) => [v.value, v.provenance])).toEqual([["men", "merchant_declared"]]);
  });

  it("ranks a rule above the model", () => {
    const rule = { ...base, dimension: "item_type" as const, value: "set_bundle", provenance: "deterministic_rule" as const };
    const model = { ...base, dimension: "item_type" as const, value: "core_item" };
    expect(resolve([model, rule]).map((v) => v.value)).toEqual(["set_bundle"]);
  });
});

describe("overrides", () => {
  const handles = new Set(["shirt", "cap"]);
  it("refuses values outside the taxonomy and pairings outside the catalogue", () => {
    expect(() => declare({ storeUrl: "s", handle: "shirt", dimension: "gift_role", values: ["sentimental"], catalogueHandles: handles })).toThrow(OverrideError);
    expect(() => declare({ storeUrl: "s", handle: "shirt", dimension: "gift_role", values: ["practical", "novelty"], catalogueHandles: handles })).toThrow(OverrideError);
    expect(() => declare({ storeUrl: "s", handle: "shirt", dimension: "known_pairings", values: ["boat"], catalogueHandles: handles })).toThrow(OverrideError);
    expect(() => declare({ storeUrl: "s", handle: "shirt", dimension: "known_pairings", values: ["shirt"], catalogueHandles: handles })).toThrow(OverrideError);
  });

  it("stores a pairing only as a merchant declaration", () => {
    const rows = declare({ storeUrl: "s", handle: "shirt", dimension: "known_pairings", values: ["cap"], catalogueHandles: handles });
    expect(rows).toMatchObject([{ value: "cap", provenance: "merchant_declared", confidence: 1 }]);
  });
});

describe("cross-merchant eligibility", () => {
  const policy = { gatePassed: new Set(["audience_fit", "margin_band", "style_register", "price_position", "assortment_role"] as const), confidenceThreshold: 0.8, minComparisonN: 10 };

  it("requires the gate, and measured confidence for model values", () => {
    expect(crossMerchantEligible(base, policy)).toBe(true);
    expect(crossMerchantEligible({ ...base, confidence: 0.6 }, policy)).toBe(false);
    expect(crossMerchantEligible({ ...base, dimension: "gift_role" }, policy)).toBe(false);
  });

  it("never lets margin_band or a provisional dimension out", () => {
    expect(crossMerchantEligible({ ...base, dimension: "margin_band", value: "high", provenance: "deterministic_rule" }, policy)).toBe(false);
    expect(crossMerchantEligible({ ...base, dimension: "style_register", value: "casual" }, policy)).toBe(false);
  });

  it("requires a comparison set of ten and evidenced behaviour", () => {
    const pos = { ...base, dimension: "price_position" as const, layer: "merchant_relative" as const, value: "mid", provenance: "deterministic_rule" as const, comparisonScope: "store" as const };
    expect(crossMerchantEligible({ ...pos, comparisonN: 9 }, policy)).toBe(false);
    expect(crossMerchantEligible({ ...pos, comparisonN: 47 }, policy)).toBe(true);
    const role = { ...base, dimension: "assortment_role" as const, layer: "merchant_relative" as const, value: "add_on", provenance: "deterministic_rule" as const };
    expect(crossMerchantEligible({ ...role, evidenceState: "provisional" }, policy)).toBe(false);
  });
});
