import { describe, expect, it } from "vitest";
import { MockProvider } from "@/lib/ai/mock";
import { checkClaims } from "@/lib/ai/guard";
import { MODULE_KEYS, MODULES, MODULE_SCHEMAS, SIDEKICK_PROMPT_KEYS } from "@/lib/domain/modules";
import { profile, product } from "./fixtures";

const provider = new MockProvider();

describe("offline generator", () => {
  for (const key of MODULE_KEYS) {
    for (const variant of ["physical", "digital"] as const) {
      it(`${key} (${variant}) produces valid output with no invented claims`, async () => {
        const p = profile({ fulfilment: variant });
        const pr = product();
        const result = await provider.generate({
          module: key,
          profile: p,
          product: MODULES[key].scope === "product" ? pr : undefined,
          products: [pr],
          options: {},
        });
        const parsed = MODULE_SCHEMAS[key].safeParse(result.output);
        if (!parsed.success) throw new Error(JSON.stringify(parsed.error.issues.slice(0, 3)));
        expect(checkClaims(parsed.data, p, pr)).toEqual([]);
      });
    }
  }

  it("works for a sparse profile with no colours, products or claims", async () => {
    const p = profile({ colours: "", personality: "", visualStyle: "", verifiedClaims: [], goal: "" });
    for (const key of MODULE_KEYS) {
      const result = await provider.generate({
        module: key,
        profile: p,
        product: product({ materials: "", benefits: "", customerProblem: "", intendedUse: "", price: null, imageNotes: "" }),
        products: [],
        options: {},
      });
      expect(MODULE_SCHEMAS[key].safeParse(result.output).success, key).toBe(true);
    }
  });

  it("writes all ten Sidekick prompts using the real brand details", async () => {
    const result = await provider.generate({ module: "theme_prompts", profile: profile(), products: [], options: {} });
    const pack = MODULE_SCHEMAS.theme_prompts.parse(result.output);
    expect(pack.prompts.map((p) => p.key)).toEqual([...SIDEKICK_PROMPT_KEYS]);
    expect(pack.prompts[0]!.prompt).toContain("Juniper & Thread");
    expect(pack.prompts[0]!.prompt).toContain("#632B39");
    expect(pack.beforeYouStart.join(" ")).toMatch(/duplicate/i);
    expect(pack.beforeYouStart.join(" ")).toMatch(/never publish/i);
  });

  it("gives free accounts a single sample prompt", async () => {
    const result = await provider.generate({ module: "theme_prompts", profile: profile(), products: [], options: { sampleOnly: true } });
    expect(MODULE_SCHEMAS.theme_prompts.parse(result.output).prompts).toHaveLength(1);
  });

  it("flags missing product facts instead of inventing them", async () => {
    const result = await provider.generate({ module: "product_listing", profile: profile(), product: product(), products: [], options: {} });
    const listing = MODULE_SCHEMAS.product_listing.parse(result.output);
    expect(listing.missingInformation.join(" ")).toMatch(/dimensions/i);
    expect(listing.missingInformation.join(" ")).toMatch(/shipping/i);
    expect(JSON.stringify(listing)).not.toMatch(/\bcm\b|free shipping/i);
  });

  it("uses US spelling for a US market", async () => {
    const result = await provider.generate({ module: "brand_blueprint", profile: profile({ market: "United States", currency: "USD" }), products: [], options: {} });
    expect(JSON.stringify(result.output)).toContain("color palette");
  });
});
