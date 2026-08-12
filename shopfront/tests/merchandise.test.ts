import { describe, expect, it, vi } from "vitest";
import { merchandise, MerchandiseError } from "@/lib/merchandise/index";
import { buildPlan } from "@/lib/merchandise/mock";
import type { GenerateRequest, GenerateResult, MerchandiseProvider } from "@/lib/merchandise/provider";
import { ShopConfig } from "@/lib/schema";
import { makeIngest } from "./helpers/ingest";

const ingest = makeIngest();
const PROMPT = "A clean bio shop for people coming from the knitwear post";

/** A provider that hands back a scripted sequence of plans. */
function scripted(plans: unknown[]): MerchandiseProvider & { requests: GenerateRequest[] } {
  const requests: GenerateRequest[] = [];
  let index = 0;
  return {
    name: "scripted",
    requests,
    async generate(request: GenerateRequest): Promise<GenerateResult> {
      requests.push(request);
      const plan = plans[Math.min(index++, plans.length - 1)];
      return { plan, model: "scripted", usage: { inputTokens: 100, outputTokens: 20 } };
    },
  };
}

const goodPlan = () => buildPlan(ingest, PROMPT);

describe("merchandise", () => {
  it("assembles a ShopConfig from a valid plan", async () => {
    const result = await merchandise(ingest, PROMPT, {
      provider: scripted([goodPlan()]),
      now: () => new Date("2026-08-11T12:00:00.000Z"),
    });

    expect(() => ShopConfig.parse(result.config)).not.toThrow();
    expect(result.diagnostics.attempts).toBe(1);
    expect(result.diagnostics.rejected).toEqual([]);
  });

  it("fills the brand from the ingest, never from the model", async () => {
    const plan = goodPlan();
    const result = await merchandise(ingest, PROMPT, {
      provider: scripted([plan]),
      now: () => new Date("2026-08-11T12:00:00.000Z"),
    });

    // A model-supplied logo URL or store URL is exactly the invented data the
    // brief forbids, so the model is never asked for them.
    expect(result.config.brand).toEqual({
      name: ingest.brand.name,
      tagline: ingest.brand.tagline,
      logoUrl: ingest.brand.logoUrl,
      storeUrl: ingest.brand.storeUrl,
    });
    expect(result.config.meta).toEqual({
      prompt: PROMPT,
      generatedAt: "2026-08-11T12:00:00.000Z",
      audience: plan.audience,
    });
  });

  it("prefers the model's tagline when it wrote one", async () => {
    const result = await merchandise(ingest, PROMPT, {
      provider: scripted([{ ...goodPlan(), tagline: "Knitted in Porto, in runs of fifty" }]),
    });
    expect(result.config.brand.tagline).toBe("Knitted in Porto, in runs of fifty");
  });
});

describe("the retry loop", () => {
  it("sends the validation errors back and accepts the fix", async () => {
    const broken = goodPlan();
    broken.blocks.push({
      id: "phantom",
      block: { type: "productGrid", products: [{ handle: "cashmere-scarf" }], layout: "grid" },
    });

    const provider = scripted([broken, goodPlan()]);
    const result = await merchandise(ingest, PROMPT, { provider });

    expect(result.diagnostics.attempts).toBe(2);
    expect(result.diagnostics.rejected[0]?.[0]).toContain("cashmere-scarf");

    // The second request carries the rejected plan *and* its errors: without
    // the plan the model is guessing which product it invented.
    const retry = provider.requests[1]!;
    expect(retry.corrections).toHaveLength(1);
    expect(retry.corrections[0]!.attempted).toEqual(broken);
    expect(retry.corrections[0]!.errors[0]).toContain("cashmere-scarf");
  });

  it("sends zod's own message back when the shape is wrong", async () => {
    const provider = scripted([{ audience: "someone", blocks: [] }, goodPlan()]);
    const result = await merchandise(ingest, PROMPT, { provider });
    expect(result.diagnostics.attempts).toBe(2);
    expect(provider.requests[1]!.corrections[0]!.errors.join(" ")).toMatch(/theme|blocks/);
  });

  it("gives up rather than rendering something invalid", async () => {
    const broken = goodPlan();
    broken.blocks = [{ id: "x", block: { type: "productGrid", products: [{ handle: "nope" }], layout: "grid" } }];

    const provider = scripted([broken]);
    const error = await merchandise(ingest, PROMPT, { provider, maxAttempts: 3 }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(MerchandiseError);
    expect((error as MerchandiseError).code).toBe("invalid-plan");
    expect((error as MerchandiseError).attempts).toHaveLength(3);
    expect(provider.requests).toHaveLength(3);
  });

  it("accumulates token usage across attempts", async () => {
    const broken = goodPlan();
    broken.blocks = [{ id: "x", block: { type: "productGrid", products: [{ handle: "nope" }], layout: "grid" } }];
    const result = await merchandise(ingest, PROMPT, { provider: scripted([broken, goodPlan()]) });
    expect(result.diagnostics.usage).toEqual({ inputTokens: 200, outputTokens: 40 });
  });
});

describe("what it refuses to start", () => {
  it("will not merchandise an empty catalogue", async () => {
    const empty = makeIngest({ catalogue: { currency: "GBP", products: [], productCount: 0, truncated: false } });
    const error = await merchandise(empty, PROMPT, { provider: scripted([goodPlan()]) }).catch((e: unknown) => e);
    expect((error as MerchandiseError).code).toBe("empty-catalogue");
  });

  it("will not merchandise without a prompt", async () => {
    const error = await merchandise(ingest, "   ", { provider: scripted([goodPlan()]) }).catch((e: unknown) => e);
    expect((error as MerchandiseError).message).toContain("prompt is the builder");
  });
});

describe("the brief handed to the provider", () => {
  it("carries the catalogue, the brand's voice and the closed URL set", async () => {
    const provider = scripted([goodPlan()]);
    await merchandise(ingest, PROMPT, { provider });
    const { brief, system } = provider.requests[0]!;

    expect(brief).toContain(PROMPT);
    expect(brief).toContain("oat-crew");
    expect(brief).toContain("sold out");
    expect(brief).toContain("Slow basics for a warm house"); // the brand's own heading
    expect(brief).toContain("https://kelpandcotton.com/pages/about");
    expect(brief).toContain("judge.me"); // reviews detected, still not available
    expect(brief).toMatch(/no reviews block available/i);
    expect(system).toContain("Never invent a discount code");
  });

  it("tells the model when the storefront never declared a currency", async () => {
    const noCurrency = makeIngest({
      catalogue: { ...ingest.catalogue, currency: null },
    });
    const provider = scripted([buildPlan(noCurrency, PROMPT)]);
    await merchandise(noCurrency, PROMPT, { provider });
    expect(provider.requests[0]!.brief).toMatch(/no copy may contain a currency symbol/i);
  });
});
