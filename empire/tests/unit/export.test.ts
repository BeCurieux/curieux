import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { MockProvider } from "@/lib/ai/mock";
import { tasksFor } from "@/lib/checklist/tasks";
import { MODULE_SCHEMAS } from "@/lib/domain/modules";
import type { Generation } from "@/lib/domain/records";
import { toMarkdown } from "@/lib/export/markdown";
import { packFiles, zipPack } from "@/lib/export/pack";
import { mergeSection, sectionsOf } from "@/lib/generation/sections";
import { profile, product } from "./fixtures";

const provider = new MockProvider();

function gen(
  module: Generation["module"],
  output: unknown,
  productId: string | null = null,
): Generation {
  return {
    id: `${module}-${productId}`,
    userId: "user-1",
    profileId: "profile-1",
    productId,
    module,
    version: 1,
    status: "succeeded",
    source: "mock",
    section: null,
    inputSnapshot: {},
    output: output as never,
    warnings: [],
    error: null,
    modelVersion: "mock-1",
    profileVersion: 1,
    createdAt: new Date().toISOString(),
  };
}

describe("export", () => {
  it("renders readable Markdown with the Sidekick prompt quoted", async () => {
    const { output } = await provider.generate({
      module: "theme_prompts",
      profile: profile(),
      products: [],
      options: {},
    });
    const md = toMarkdown(
      "theme_prompts",
      MODULE_SCHEMAS.theme_prompts.parse(output),
      "Juniper & Thread",
    );
    expect(md).toMatch(/^# Sidekick prompt pack — Juniper & Thread/);
    expect(md).toContain("### Global design settings");
    expect(md).toContain("> In my theme settings");
    expect(md).toContain("**Check afterwards:**");
  });

  it("zips a structured pack with README and checklist", async () => {
    const p = profile();
    const pr = product();
    const blueprint = (
      await provider.generate({ module: "brand_blueprint", profile: p, products: [], options: {} })
    ).output;
    const listing = (
      await provider.generate({
        module: "product_listing",
        profile: p,
        product: pr,
        products: [pr],
        options: {},
      })
    ).output;
    const tasks = tasksFor(p).map((t, i) => ({
      id: `t${i}`,
      userId: "user-1",
      profileId: p.id,
      taskKey: t.key,
      category: t.category,
      label: t.label,
      status: i === 0 ? ("complete" as const) : ("not_started" as const),
      notes: "",
      updatedAt: "",
    }));
    const files = packFiles(
      p,
      [pr],
      [gen("brand_blueprint", blueprint), gen("product_listing", listing, pr.id)],
      tasks,
    );
    const unzipped = unzipSync(zipPack(files, "juniper-launch-pack"));
    const names = Object.keys(unzipped).sort();
    expect(names).toEqual([
      "juniper-launch-pack/README.md",
      "juniper-launch-pack/brand/brand-blueprint.md",
      "juniper-launch-pack/launch-checklist.md",
      "juniper-launch-pack/products/the-everyday-apron/product-listing.md",
    ]);
    expect(strFromU8(unzipped["juniper-launch-pack/launch-checklist.md"]!)).toContain("- [x]");
  });
});

describe("section regeneration", () => {
  it("replaces one Sidekick prompt and keeps the rest", async () => {
    const base = MODULE_SCHEMAS.theme_prompts.parse(
      (
        await provider.generate({
          module: "theme_prompts",
          profile: profile(),
          products: [],
          options: {},
        })
      ).output,
    );
    const fresh = structuredClone(base);
    fresh.prompts[1]!.prompt = "A brand new hero prompt.";
    fresh.prompts[0]!.prompt = "Should not be copied.";
    const merged = mergeSection("theme_prompts", base, fresh, "prompt:hero") as typeof base;
    expect(merged.prompts[1]!.prompt).toBe("A brand new hero prompt.");
    expect(merged.prompts[0]!.prompt).toBe(base.prompts[0]!.prompt);
    expect(sectionsOf("theme_prompts", base)).toContain("prompt:footer_nav");
  });

  it("ignores sections that don't exist", async () => {
    const base = MODULE_SCHEMAS.homepage_copy.parse(
      (
        await provider.generate({
          module: "homepage_copy",
          profile: profile(),
          products: [],
          options: {},
        })
      ).output,
    );
    expect(mergeSection("homepage_copy", base, { ...base, heroHeadline: "x" }, "__proto__")).toBe(
      base,
    );
    expect(sectionsOf("homepage_copy", base)).not.toContain("needsYourInput");
  });
});

describe("launch checklist", () => {
  it("adapts to what she sells", () => {
    const physical = tasksFor({ fulfilment: "physical" }).map((t) => t.key);
    const digital = tasksFor({ fulfilment: "digital" }).map((t) => t.key);
    expect(physical).toContain("ship-rates");
    expect(physical).not.toContain("digital-delivery");
    expect(digital).toContain("digital-delivery");
    expect(digital).not.toContain("ship-rates");
    expect(tasksFor({ fulfilment: "both" }).map((t) => t.key)).toEqual(
      expect.arrayContaining(["ship-rates", "digital-delivery"]),
    );
  });
});
