import { describe, expect, it } from "vitest";
import { assess, evaluate } from "@/engine/assess.js";
import { readFact } from "@/engine/facts.js";
import { AS_OF, product, rule, snapshotOf, withFact } from "./helpers.js";

describe("assess: rule selection", () => {
  it("applies only rules for the market, the category and the date", () => {
    const eu = rule({ kind: "required_field", params: { facts: ["net_quantity"] } });
    const us = rule({ market: "US", kind: "required_field", params: { facts: ["net_quantity"] } });
    const cosmetics = rule({ category: "cosmetics", kind: "required_field", params: { facts: ["net_quantity"] } });
    const future = rule({
      kind: "required_field",
      params: { facts: ["net_quantity"] },
      citation: { regulation: "R", article: "A", url: "https://example.org", effective_from: "2030-01-01" },
    });
    const expired = rule({
      kind: "required_field",
      params: { facts: ["net_quantity"] },
      citation: { regulation: "R", article: "A", url: "https://example.org", effective_from: "2010-01-01", effective_to: AS_OF },
    });
    const result = assess(product({}), "EU", snapshotOf(eu, us, cosmetics, future, expired), { asOf: AS_OF });
    expect(result.findings.map((f) => f.ruleKey)).toEqual([eu.rule_key]);
    expect(result.rulesVersion).toMatch(/^r-[0-9a-f]{16}$/);
    expect(result.asOf).toBe(AS_OF);
  });

  it("says not_assessed, never ready, for a market with no rules", () => {
    const result = assess(product({ net_quantity: "60 capsules" }), "UK", snapshotOf(), { asOf: AS_OF });
    expect(result.findings).toEqual([]);
    expect(result.score).toBe("not_assessed");
  });

  it("says not_assessed for a product with no category", () => {
    const r = rule({ kind: "required_field", params: { facts: ["net_quantity"] } });
    const result = assess(product({}, null), "EU", snapshotOf(r), { asOf: AS_OF });
    expect(result.score).toBe("not_assessed");
  });

  it("is deterministic", () => {
    const r = rule({ kind: "claim", params: { phrases: ["cures"] } });
    const p = product({ claims: ["Cures colds"] });
    const s = snapshotOf(r);
    expect(assess(p, "EU", s, { asOf: AS_OF })).toEqual(assess(p, "EU", s, { asOf: AS_OF }));
  });
});

describe("facts", () => {
  it("does not use an unconfirmed ai_extracted fact", () => {
    const p = withFact(product({}), "net_quantity", { value: "60 capsules", source: "ai_extracted", confidence: 0.99 });
    expect(readFact(p, "net_quantity").state).toBe("unconfirmed");
    const confirmed = withFact(p, "net_quantity", { value: "60 capsules", source: "ai_extracted", confirmed: true });
    expect(readFact(confirmed, "net_quantity")).toMatchObject({ state: "known", value: "60 capsules" });
  });

  it("treats a value of the wrong shape as absent", () => {
    const p = withFact(product({}), "daily_servings", { value: "two" as unknown as number, source: "shopify" });
    expect(readFact(p, "daily_servings").state).toBe("absent");
  });
});

describe("required_field", () => {
  const r = rule({ kind: "required_field", params: { facts: ["responsible_person_name", "responsible_person_address"] } });

  it("passes when every field is present", () => {
    const f = evaluate(r, product({ responsible_person_name: "Acme GmbH", responsible_person_address: "Berlin" }));
    expect(f.status).toBe("pass");
    expect(f.fixText).toBeNull();
  });

  it("fails on a missing or empty field, with the fix", () => {
    const f = evaluate(r, product({ responsible_person_name: "Acme GmbH", responsible_person_address: "  " }));
    expect(f.status).toBe("fail");
    expect(f.evidence["missing"]).toEqual(["responsible_person_address"]);
    expect(f.fixText).toBe("Do the thing.");
  });

  it("treats false as not on the label", () => {
    const lot = rule({ kind: "required_field", params: { facts: ["batch_code"] } });
    expect(evaluate(lot, product({ batch_code: false })).status).toBe("fail");
    expect(evaluate(lot, product({ batch_code: true })).status).toBe("pass");
  });

  it("is not assessed while a field is unconfirmed", () => {
    const p = withFact(product({ responsible_person_name: "Acme GmbH" }), "responsible_person_address", {
      value: "Berlin",
      source: "ai_extracted",
    });
    const f = evaluate(r, p);
    expect(f.status).toBe("not_assessed");
    expect(f.evidence["unconfirmed"]).toEqual(["responsible_person_address"]);
  });

  it("still fails on a missing field when another is unconfirmed", () => {
    const p = withFact(product({}), "responsible_person_address", { value: "Berlin", source: "ai_extracted" });
    expect(evaluate(r, p).status).toBe("fail");
  });
});

describe("prohibited_substance", () => {
  const r = rule({
    kind: "prohibited_substance",
    severity: "blocked",
    params: { substances: [{ name: "ephedra", aliases: ["ma huang"] }] },
  });

  it("fails on the substance or an alias, as whole words", () => {
    const f = evaluate(r, product({ ingredients: [{ name: "Ma Huang extract" }, { name: "Vitamin C" }] }));
    expect(f.status).toBe("fail");
    expect(f.evidence["matches"]).toEqual([{ ingredient: "Ma Huang extract", substance: "ephedra", matched: "ma huang" }]);
  });

  it("passes when nothing matches, including near-misses inside a word", () => {
    expect(evaluate(r, product({ ingredients: [{ name: "Ephedrasoft fibre" }] })).status).toBe("pass");
  });

  it("is not assessed without ingredients", () => {
    expect(evaluate(r, product({})).evidence["reason"]).toBe("no-ingredients");
    const p = withFact(product({}), "ingredients", { value: [{ name: "Ephedra" }], source: "ai_extracted" });
    expect(evaluate(r, p).status).toBe("not_assessed");
  });
});

describe("limit", () => {
  const r = rule({
    kind: "limit",
    params: { nutrient: "vitamin d", aliases: ["cholecalciferol"], max: 20, unit: "µg" },
  });

  it("multiplies the per-serving amount by servings per day", () => {
    const f = evaluate(r, product({ ingredients: [{ name: "Vitamin D3 (cholecalciferol)", amount: 12.5, unit: "mcg" }], daily_servings: 2 }));
    expect(f.status).toBe("fail");
    expect(f.evidence).toMatchObject({ perServing: 12.5, daily: 25, max: 20, unit: "µg" });
  });

  it("converts units", () => {
    const f = evaluate(r, product({ ingredients: [{ name: "Cholecalciferol", amount: 0.01, unit: "mg" }], daily_servings: 1 }));
    expect(f.status).toBe("pass");
    expect(f.evidence["daily"]).toBe(10);
  });

  it("passes when the nutrient is absent", () => {
    expect(evaluate(r, product({ ingredients: [{ name: "Zinc", amount: 10, unit: "mg" }] })).status).toBe("pass");
  });

  it("does not convert IU", () => {
    const f = evaluate(r, product({ ingredients: [{ name: "Vitamin D", amount: 1000, unit: "IU" }], daily_servings: 1 }));
    expect(f.status).toBe("not_assessed");
    expect(f.evidence["reason"]).toBe("amount-not-in-mass");
  });

  it("is not assessed without an amount or servings per day", () => {
    expect(evaluate(r, product({ ingredients: [{ name: "Vitamin D" }], daily_servings: 1 })).status).toBe("not_assessed");
    expect(evaluate(r, product({ ingredients: [{ name: "Vitamin D", amount: 5, unit: "µg" }] })).evidence["reason"]).toBe(
      "no-daily-servings",
    );
  });
});

describe("warning_text", () => {
  const r = rule({
    kind: "warning_text",
    params: {
      texts: {
        en: "Do not exceed the recommended daily dose.",
        fr: "Ne pas dépasser la dose journalière recommandée.",
      },
    },
  });

  it("passes when the statement is present in every label language it is defined for", () => {
    const p = product({
      languages: ["en", "fr"],
      warnings: ["DO NOT EXCEED  the recommended daily dose"],
      label_text: "… Ne pas dépasser la dose journalière recommandée. …",
    });
    expect(evaluate(r, p).status).toBe("pass");
  });

  it("fails naming the language that is missing", () => {
    const p = product({ languages: ["en", "fr"], warnings: ["Do not exceed the recommended daily dose."] });
    const f = evaluate(r, p);
    expect(f.status).toBe("fail");
    expect(f.evidence["missing"]).toEqual(["fr"]);
  });

  it("does not forgive a missing accent", () => {
    const p = product({ languages: ["fr"], label_text: "Ne pas depasser la dose journaliere recommandee." });
    expect(evaluate(r, p).status).toBe("fail");
  });

  it("fails when the label has none of the statement's languages", () => {
    const f = evaluate(r, product({ languages: ["de"], label_text: "" }));
    expect(f.status).toBe("fail");
    expect(f.evidence["reason"]).toBe("no-label-language-for-statement");
  });

  it("fails when there is no label text at all", () => {
    expect(evaluate(r, product({ languages: ["en"] })).status).toBe("fail");
  });

  it("is not assessed when languages are unknown, or the text it would be in is unconfirmed", () => {
    expect(evaluate(r, product({ warnings: [] })).status).toBe("not_assessed");
    const p = withFact(product({ languages: ["en"] }), "label_text", { value: "Do not exceed the recommended daily dose.", source: "ai_extracted" });
    expect(evaluate(r, p).status).toBe("not_assessed");
  });

  it("applies_if: an ingredient condition", () => {
    const iron = rule({ kind: "warning_text", applies_if: { ingredient_any: ["iron"] }, params: { texts: { en: "Iron warning." } } });
    expect(evaluate(iron, product({ ingredients: [{ name: "Zinc" }], languages: ["en"] })).evidence["reason"]).toBe("not-applicable");
    expect(evaluate(iron, product({ ingredients: [{ name: "Iron (as ferrous fumarate)" }], languages: ["en"] })).status).toBe("fail");
    expect(evaluate(iron, product({ languages: ["en"] })).status).toBe("not_assessed");
  });

  it("applies_if: a fact condition", () => {
    const disclaimer = rule({ kind: "warning_text", applies_if: { fact_present: "claims" }, params: { texts: { en: "Not evaluated." } } });
    expect(evaluate(disclaimer, product({ claims: [], languages: ["en"] })).status).toBe("pass");
    expect(evaluate(disclaimer, product({ claims: ["Supports immunity"], languages: ["en"] })).status).toBe("fail");
    const unconfirmed = withFact(product({ languages: ["en"] }), "claims", { value: ["x"], source: "ai_extracted" });
    expect(evaluate(disclaimer, unconfirmed).status).toBe("not_assessed");
  });
});

describe("language", () => {
  it("any: one of the languages is enough", () => {
    const r = rule({ kind: "language", params: { mode: "any", languages: ["de", "fr"] } });
    expect(evaluate(r, product({ languages: ["en", "fr"] })).status).toBe("pass");
    expect(evaluate(r, product({ languages: ["en"] })).status).toBe("fail");
  });

  it("all: every language is needed", () => {
    const r = rule({ kind: "language", params: { mode: "all", languages: ["en", "fr"] } });
    expect(evaluate(r, product({ languages: ["en"] })).status).toBe("fail");
    expect(evaluate(r, product({ languages: ["fr", "en"] })).status).toBe("pass");
  });

  it("is not assessed without languages", () => {
    const r = rule({ kind: "language", params: { mode: "all", languages: ["en"] } });
    expect(evaluate(r, product({})).status).toBe("not_assessed");
  });
});

describe("registration", () => {
  it("is always a to-do, never scored", () => {
    const r = rule({ kind: "registration", severity: "advisory", params: { action: "Notify", url: "https://example.org/notify" } });
    const f = evaluate(r, product({}));
    expect(f.status).toBe("not_assessed");
    expect(f.scored).toBe(false);
    expect(f.evidence).toMatchObject({ reason: "registration-to-do", url: "https://example.org/notify" });
  });
});

describe("claim", () => {
  const r = rule({ kind: "claim", params: { phrases: ["cures", "prevents disease"] } });

  it("fails on a phrase in claims or label text, saying where", () => {
    const f = evaluate(r, product({ claims: ["Supports energy"], label_text: "Our tonic cures fatigue." }));
    expect(f.status).toBe("fail");
    expect(f.evidence["matches"]).toEqual([{ phrase: "cures", where: "label_text", text: "Our tonic cures fatigue." }]);
  });

  it("matches whole words only", () => {
    expect(evaluate(r, product({ claims: ["Secures your routine"] })).status).toBe("pass");
  });

  it("is not assessed on silence or on unconfirmed text", () => {
    expect(evaluate(r, product({})).status).toBe("not_assessed");
    const p = withFact(product({ claims: [] }), "label_text", { value: "harmless", source: "ai_extracted" });
    expect(evaluate(r, p).status).toBe("not_assessed");
  });

  it("fails on confirmed text even when other text is unconfirmed", () => {
    const p = withFact(product({ claims: ["Cures everything"] }), "label_text", { value: "", source: "ai_extracted" });
    expect(evaluate(r, p).status).toBe("fail");
  });
});

describe("finding shape", () => {
  it("carries the rule's id, citation and version on every finding", () => {
    const r = rule({ rule_key: "net-qty", kind: "required_field", params: { facts: ["net_quantity"] } });
    const f = evaluate(r, product({}));
    expect(f).toMatchObject({
      ruleId: "eu.supplements.net-qty",
      ruleKey: "net-qty",
      ruleVersion: 1,
      kind: "required_field",
      citation: r.citation,
      scored: true,
    });
  });

  it("does not score drafted, needs_review or advisory rules", () => {
    const base = { kind: "required_field" as const, params: { facts: ["net_quantity" as const] } };
    expect(evaluate(rule({ ...base, confidence: "drafted" }), product({})).scored).toBe(false);
    expect(evaluate(rule({ ...base, confidence: "needs_review" }), product({})).scored).toBe(false);
    expect(evaluate(rule({ ...base, severity: "advisory" }), product({})).scored).toBe(false);
  });
});
