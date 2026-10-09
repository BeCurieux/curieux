/**
 * The engine is pure TypeScript (BUILD_BRIEF.md §5): no filesystem, network,
 * clock, randomness or model. Checked on the source, because the failure this
 * prevents is a convenient import added months from now.
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assess } from "@/engine/assess.js";
import { createSnapshot } from "@/engine/snapshot.js";
import { loadSnapshot } from "@/rules/load.js";
import { AS_OF } from "./helpers.js";
import type { ProductFacts } from "@/engine/facts.js";
import type { MarketCode } from "@/engine/rules.js";

const ENGINE = path.resolve(import.meta.dirname, "../src/engine");

describe("engine purity", () => {
  it("imports nothing but zod, node:crypto and itself", async () => {
    for (const file of await readdir(ENGINE)) {
      const source = await readFile(path.join(ENGINE, file), "utf8");
      const imports = [...source.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
      for (const spec of imports) expect([file, spec]).toSatisfy(([, s]: string[]) => s === "zod" || s === "node:crypto" || s!.startsWith("./"));
    }
  });

  it("reads no clock, randomness, network or environment", async () => {
    for (const file of await readdir(ENGINE)) {
      const source = await readFile(path.join(ENGINE, file), "utf8");
      for (const banned of ["Date.now", "new Date(", "Math.random", "fetch(", "process.env", "anthropic"]) {
        expect([file, source.includes(banned)]).toEqual([file, false]);
      }
    }
  });
});

describe("engine performance (BUILD_BRIEF.md §9: 250 SKUs × 3 markets < 30s)", () => {
  it("assesses 250 products in three markets well inside the budget", async () => {
    const seeds = await loadSnapshot(path.resolve(import.meta.dirname, "../rules"));
    const snapshot = createSnapshot(seeds.rules.map((r) => ({ ...r, confidence: "verified" as const })));
    const products: ProductFacts[] = Array.from({ length: 250 }, (_, i) => ({
      productId: `p${i}`,
      category: "supplements",
      facts: {
        languages: { value: ["en", "de"], source: "merchant_input" },
        ingredients: {
          value: Array.from({ length: 20 }, (_, j) => ({ name: `Ingredient ${j} extract`, amount: j, unit: "mg" })),
          source: "merchant_input",
        },
        daily_servings: { value: 2, source: "merchant_input" },
        claims: { value: ["Supports wellbeing", "Made with care"], source: "merchant_input" },
        label_text: { value: "Lorem ipsum ".repeat(400), source: "merchant_input" },
        net_quantity: { value: "60 capsules", source: "merchant_input" },
      },
    }));
    const started = performance.now();
    let count = 0;
    for (const p of products) for (const m of ["EU", "UK", "US"] as MarketCode[]) count += assess(p, m, snapshot, { asOf: AS_OF }).findings.length;
    const elapsed = performance.now() - started;
    expect(count).toBeGreaterThan(250 * 30);
    // The brief's budget is 30s; hold the engine to a tenth of it so there is
    // room for I/O around it.
    expect(elapsed).toBeLessThan(3_000);
  });
});
