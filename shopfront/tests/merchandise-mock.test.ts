/**
 * The deterministic merchandiser has one hard contract: it always produces a
 * plan that passes validation. It is the renderer's fixture and the model's
 * baseline, and both jobs fail if it can emit something invalid.
 */

import { describe, expect, it } from "vitest";
import { buildPlan } from "@/lib/merchandise/mock";
import { MerchandisingPlan } from "@/lib/merchandise/plan";
import { validatePlan } from "@/lib/merchandise/validate";
import { collectAllowedUrls } from "@/lib/merchandise/prompt";
import type { IngestResult } from "@/lib/ingest/types";
import { makeIngest } from "./helpers/ingest";

const ingest = makeIngest();

function planFor(prompt: string, source: IngestResult = ingest) {
  const plan = buildPlan(source, prompt);
  const parsed = MerchandisingPlan.safeParse(plan);
  expect(parsed.success, parsed.success ? "" : JSON.stringify(parsed.error.issues)).toBe(true);
  const validation = validatePlan({
    plan,
    ingest: source,
    prompt,
    allowedUrls: collectAllowedUrls(source),
  });
  expect(validation.errors).toEqual([]);
  return plan;
}

describe("buildPlan", () => {
  it("is a hero, an edit and the links", () => {
    const plan = planFor("A clean bio shop");
    expect(plan.blocks.map((b) => b.block.type)).toEqual(["hero", "productGrid", "linkList"]);
  });

  it("leads with the brand's own line rather than inventing one", () => {
    const plan = planFor("A clean bio shop");
    const hero = plan.blocks[0]!.block;
    expect(hero.type).toBe("hero");
    if (hero.type === "hero") expect(hero.headline).toBe(ingest.brand.tagline);
  });

  it("honours a price cap from the prompt", () => {
    const plan = planFor("Everything under £80");
    const grid = plan.blocks.find((b) => b.block.type === "productGrid")!.block;
    if (grid.type !== "productGrid") throw new Error("expected a grid");
    // £148 crew and £215 throw are both out; the £18.50 tea towel stays.
    expect(grid.products.map((p) => p.handle)).toEqual(["linen-tea-towel", "care-card"]);
    expect(grid.title).toBe("Under £80");
  });

  it('reads "nothing over" as a cap, but not a bare "over"', () => {
    const capped = planFor("Nothing over £80");
    const grid = capped.blocks.find((b) => b.block.type === "productGrid")!.block;
    if (grid.type !== "productGrid") throw new Error("expected a grid");
    expect(grid.products.map((p) => p.handle)).toEqual(["linen-tea-towel", "care-card"]);

    const uncapped = planFor("Our pieces over £80 deserve the spotlight");
    const all = uncapped.blocks.find((b) => b.block.type === "productGrid")!.block;
    if (all.type !== "productGrid") throw new Error("expected a grid");
    expect(all.products.length).toBeGreaterThan(2);
  });

  it("keeps sold-out products unless the brief asked otherwise", () => {
    const kept = planFor("A clean bio shop");
    const grid = kept.blocks.find((b) => b.block.type === "productGrid")!.block;
    if (grid.type !== "productGrid") throw new Error("expected a grid");
    // The tea towel is sold out; it is shown and marked, not filtered away.
    expect(grid.products.map((p) => p.handle)).toContain("linen-tea-towel");

    const filtered = planFor("Only what's in stock");
    const inStock = filtered.blocks.find((b) => b.block.type === "productGrid")!.block;
    if (inStock.type !== "productGrid") throw new Error("expected a grid");
    expect(inStock.products.map((p) => p.handle)).not.toContain("linen-tea-towel");
  });

  it("puts photographed products first", () => {
    const plan = planFor("A clean bio shop");
    const grid = plan.blocks.find((b) => b.block.type === "productGrid")!.block;
    if (grid.type !== "productGrid") throw new Error("expected a grid");
    // care-card has no imagery, so it goes last rather than being dropped.
    expect(grid.products[grid.products.length - 1]!.handle).toBe("care-card");
  });

  it("writes no price when the storefront declared no currency", () => {
    const noCurrency = makeIngest({ catalogue: { ...ingest.catalogue, currency: null } });
    const plan = planFor("Everything under 80", noCurrency);
    const grid = plan.blocks.find((b) => b.block.type === "productGrid")!.block;
    if (grid.type !== "productGrid") throw new Error("expected a grid");
    expect(grid.title).toBe("The edit");
  });

  it("falls back to the brand name when the tagline would fail validation", () => {
    const dodgy = makeIngest();
    const plan = planFor("A clean bio shop", {
      ...dodgy,
      brand: { ...dodgy.brand, tagline: "Always in sync with our store" },
    });
    const hero = plan.blocks[0]!.block;
    if (hero.type !== "hero") throw new Error("expected a hero");
    expect(hero.headline).toBe(dodgy.brand.name);
  });

  it("substitutes a legible colourway if the brand's own is not", () => {
    const source = makeIngest();
    const plan = planFor("A clean bio shop", {
      ...source,
      brand: {
        ...source.brand,
        suggestedColorway: { background: "#ffffff", surface: "#eee", text: "#f4f4f4", accent: "#f0f0f0" },
      },
    });
    expect(plan.theme.colorway.text).toBe("#111111");
  });
});
