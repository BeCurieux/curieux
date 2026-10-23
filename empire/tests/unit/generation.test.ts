import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetServerEnv } from "@/env";
import { localStore } from "@/lib/data";
import { MockProvider } from "@/lib/ai/mock";
import { GenerationError } from "@/lib/ai/errors";
import { setAIProvider, type AIProvider } from "@/lib/ai/provider";
import { runGeneration, saveVersion } from "@/lib/generation/run";
import { profileFactsSchema } from "@/lib/domain/profile";
import { productInputSchema } from "@/lib/domain/product";
import { FREE } from "@/lib/billing/plans";

const facts = profileFactsSchema.parse({
  brandName: "Juniper & Thread",
  category: "Home and living",
  audience: "New mums",
  productsSummary: "Aprons",
  market: "Australia",
  currency: "AUD",
  stage: "prelaunch",
  fulfilment: "physical",
  prohibitedClaims: ["eco-friendly"],
});

async function setup() {
  const store = localStore();
  const user = await store.upsertUser(`u-${Math.random()}@example.test`);
  const repo = store.forUser(user.id);
  const profile = await repo.createProfile(facts);
  return { store, user, repo, profile };
}

function provider(
  generate: AIProvider["generate"],
  name: "mock" | "anthropic" = "mock",
): AIProvider {
  return { name, generate } as AIProvider;
}

beforeEach(() => {
  process.env.EMPIRE_DATA_DIR = mkdtempSync(path.join(tmpdir(), "empire-gen-"));
  process.env.EMPIRE_BACKEND = "local";
  process.env.EMPIRE_AI_PROVIDER = "mock";
  process.env.EMPIRE_AI_TIMEOUT_MS = "10000";
  delete process.env.VERCEL_ENV;
  resetServerEnv();
  setAIProvider(new MockProvider());
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  setAIProvider(null);
  vi.restoreAllMocks();
});

describe("generation service", () => {
  it("saves a version, applies the blueprint to the profile and records usage", async () => {
    const { repo, profile } = await setup();
    const result = await runGeneration({ repo, profileId: profile.id, module: "brand_blueprint" });
    expect(result.ok).toBe(true);
    expect((await repo.getProfile(profile.id))?.brand?.positioning).toContain("Juniper & Thread");
    const usage = await repo.listUsage(new Date(0).toISOString());
    expect(usage.map((u) => u.operation)).toEqual(["generate"]);
  });

  it("rejects malformed output and doesn't charge for it", async () => {
    const { repo, profile } = await setup();
    setAIProvider(
      provider(async () => ({
        output: { positioning: 42 },
        model: "m",
        usage: { inputTokens: 10, outputTokens: 5 },
      })),
    );
    const result = await runGeneration({ repo, profileId: profile.id, module: "brand_blueprint" });
    expect(result).toMatchObject({ ok: false, reason: "failed" });
    const [failed] = await repo.listGenerations(profile.id);
    expect(failed).toMatchObject({ status: "failed", output: null });
    const usage = await repo.listUsage(new Date(0).toISOString());
    expect(usage.map((u) => u.operation)).toEqual(["generate_failed"]);
    // Failures don't use up the allowance: the free plan still has every generation.
    for (let i = 0; i < FREE.generations; i += 1) {
      setAIProvider(new MockProvider());
      expect(
        (await runGeneration({ repo, profileId: profile.id, module: "brand_blueprint" })).ok,
      ).toBe(true);
    }
    expect(
      await runGeneration({ repo, profileId: profile.id, module: "brand_blueprint" }),
    ).toMatchObject({ ok: false, reason: "allowance" });
  });

  it("reports a provider error without leaking internals", async () => {
    const { repo, profile } = await setup();
    setAIProvider(
      provider(async () => {
        throw new GenerationError("The writing service is busy. Try again in a minute.");
      }),
    );
    expect(
      await runGeneration({ repo, profileId: profile.id, module: "brand_blueprint" }),
    ).toMatchObject({
      ok: false,
      message: "The writing service is busy. Try again in a minute.",
    });
    setAIProvider(
      provider(async () => {
        throw new Error("ECONNRESET at 10.0.0.1 with key sk-ant-xyz");
      }),
    );
    const result = await runGeneration({ repo, profileId: profile.id, module: "brand_blueprint" });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("sk-ant");
  });

  it("times out a slow generation", async () => {
    process.env.EMPIRE_AI_TIMEOUT_MS = "1000";
    resetServerEnv();
    const { repo, profile } = await setup();
    let aborted = false;
    setAIProvider(
      provider(
        ({ signal }) =>
          new Promise((_, reject) =>
            signal?.addEventListener("abort", () => {
              aborted = true;
              reject(new Error("aborted"));
            }),
          ),
      ),
    );
    expect(
      await runGeneration({ repo, profileId: profile.id, module: "brand_blueprint" }),
    ).toMatchObject({ ok: false, message: expect.stringMatching(/too long/) });
    expect(aborted).toBe(true);
  });

  it("stops at the platform's daily spending ceiling", async () => {
    process.env.EMPIRE_AI_PROVIDER = "anthropic";
    process.env.ANTHROPIC_API_KEY = "test";
    process.env.EMPIRE_AI_DAILY_BUDGET_USD = "1";
    resetServerEnv();
    const { store, repo, profile } = await setup();
    await store.system().recordUsage({
      userId: "someone",
      generationId: null,
      module: "brand_blueprint",
      operation: "generate",
      inputTokens: 0,
      outputTokens: 0,
      estimatedCost: 1.5,
    });
    const result = await runGeneration({ repo, profileId: profile.id, module: "brand_blueprint" });
    expect(result).toMatchObject({ ok: false, reason: "platform" });
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.EMPIRE_AI_DAILY_BUDGET_USD;
  });

  it("won't generate for another customer's profile or product", async () => {
    const a = await setup();
    const b = await setup();
    expect(
      await runGeneration({ repo: b.repo, profileId: a.profile.id, module: "brand_blueprint" }),
    ).toMatchObject({ ok: false, reason: "not_found" });
    const product = await a.repo.createProduct(
      a.profile.id,
      productInputSchema.parse({ name: "Apron" }),
    );
    expect(
      await runGeneration({
        repo: b.repo,
        profileId: b.profile.id,
        module: "product_listing",
        productId: product.id,
      }),
    ).toMatchObject({ ok: false, reason: "not_found" });
  });

  it("flags a prohibited claim in a saved edit", async () => {
    const { repo, profile } = await setup();
    const result = await runGeneration({ repo, profileId: profile.id, module: "brand_blueprint" });
    if (!result.ok) throw new Error(result.message);
    const edited = { ...result.generation.output, positioning: "An eco-friendly apron brand." };
    const saved = await saveVersion(repo, result.generation.id, edited, "edit");
    expect(saved.ok && saved.generation.warnings.join(" ")).toMatch(/never to say/);
    expect(saved.ok && saved.generation.version).toBe(2);
  });

  it("refuses an invalid edit and keeps the saved version", async () => {
    const { repo, profile } = await setup();
    const result = await runGeneration({ repo, profileId: profile.id, module: "brand_blueprint" });
    if (!result.ok) throw new Error(result.message);
    const saved = await saveVersion(
      repo,
      result.generation.id,
      { ...result.generation.output, colourPalette: [{ name: "x", hex: "red", use: "y" }] },
      "edit",
    );
    expect(saved.ok).toBe(false);
    expect(
      (await repo.listGenerations(profile.id)).filter((g) => g.status === "succeeded"),
    ).toHaveLength(1);
  });
});
