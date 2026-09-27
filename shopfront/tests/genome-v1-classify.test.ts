import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import fixture from "../fixtures/bench-and-bolt.ingest.json";
import type { IngestResult } from "@/lib/ingest/types";
import { classifyCatalogue } from "@/lib/genome/v1/classify";
import { createMockClassifier, mockClassify } from "@/lib/genome/v1/mock";
import { createAnthropicClassifier } from "@/lib/genome/v1/anthropic";
import { OverBudgetError, projectCatalogue, usdFor } from "@/lib/genome/v1/cost";
import type { ClassifierProvider, RunResult } from "@/lib/genome/v1/provider";
import { PROMPT_VERSION } from "@/lib/genome/v1/prompt";
import { classifierInput, inputsHash } from "@/lib/genome/v1/inputs";

const ingest = fixture as unknown as IngestResult;
const storeUrl = ingest.store.storeUrl;
const catalogue = ingest.catalogue;

const tmpLedger = async () => ({ file: path.join(await mkdtemp(path.join(os.tmpdir(), "ledger-")), "spend.json") });

/** A paid provider that answers like the mock and bills like Sonnet in a batch. */
function paidFake(overrides: Partial<ClassifierProvider> = {}): ClassifierProvider & { calls: number } {
  const fake = {
    name: "fake",
    model: "claude-sonnet-5",
    billing: "batch" as const,
    calls: 0,
    async countInputTokens() {
      return 2_500;
    },
    async classify(requests: readonly { customId: string; input: Parameters<typeof mockClassify>[0] }[]): Promise<RunResult[]> {
      fake.calls += 1;
      return requests.map((r) => ({
        customId: r.customId,
        output: mockClassify(r.input),
        error: null,
        usage: { inputTokens: 500, outputTokens: 200, cacheReadTokens: 2_000, cacheWriteTokens: 0 },
      }));
    },
    ...overrides,
  };
  return fake;
}

describe("classifyCatalogue", () => {
  it("classifies every product five times and records provenance on every value", async () => {
    const result = await classifyCatalogue({ storeUrl, catalogue, provider: createMockClassifier(), now: new Date("2026-09-26T00:00:00Z") });
    expect(result.requests).toBe(catalogue.products.length * 5);
    expect(result.products).toHaveLength(catalogue.products.length);

    const drill = result.values.filter((v) => v.handle === catalogue.products[0]!.handle);
    const dims = new Set(drill.map((v) => v.dimension));
    for (const d of ["occasion_fit", "gift_role", "use_context", "seasonality", "audience_fit", "item_type", "style_register", "price_band", "price_position", "inventory_depth", "margin_band", "assortment_role"]) {
      expect(dims, d).toContain(d);
    }
    const model = drill.find((v) => v.dimension === "gift_role")!;
    expect(model).toMatchObject({ provenance: "taxonomy_model", runAgreement: "5/5", confidence: 1, promptVersion: PROMPT_VERSION });
    const margin = drill.find((v) => v.dimension === "margin_band")!;
    expect(margin).toMatchObject({ provenance: "deterministic_rule", value: "unknown", rawValue: "no cost per item" });
    // Ten products, three types: no type reaches ten, the store exactly does.
    expect(drill.find((v) => v.dimension === "price_position")).toMatchObject({ comparisonScope: "store", comparisonN: 10 });
  });

  it("never sends the price to the model, so a price change does not reclassify", () => {
    const product = catalogue.products[0]!;
    const cheaper = { ...product, variants: product.variants.map((v) => ({ ...v, price: v.price / 2 })) };
    expect(inputsHash(classifierInput(product))).toBe(inputsHash(classifierInput(cheaper)));
    expect(JSON.stringify(classifierInput(product))).not.toContain(String(product.variants[0]!.price));
  });

  it("reuses stored values when the inputs, prompt and model are unchanged", async () => {
    const first = await classifyCatalogue({ storeUrl, catalogue, provider: createMockClassifier() });
    const edited = {
      ...catalogue,
      products: catalogue.products.map((p, i) => (i === 0 ? { ...p, title: `${p.title} (2026)` } : p)),
    };
    const second = await classifyCatalogue({ storeUrl, catalogue: edited, provider: createMockClassifier(), previous: first });
    expect(second.reused).toBe(catalogue.products.length - 1);
    expect(second.requests).toBe(5);
    // The reused products keep their model rows.
    const unchanged = catalogue.products[1]!.handle;
    expect(second.values.filter((v) => v.handle === unchanged && v.provenance === "taxonomy_model").length).toBeGreaterThan(0);
  });

  it("does not reuse a result made with fewer runs than asked for", async () => {
    const once = await classifyCatalogue({ storeUrl, catalogue, provider: createMockClassifier(), runs: 1 });
    const five = await classifyCatalogue({ storeUrl, catalogue, provider: createMockClassifier(), runs: 5, previous: once });
    expect(five.reused).toBe(0);
  });

  it("refuses a paid run whose estimate would cross the cap, before sending anything", async () => {
    const provider = paidFake();
    const ledger = await tmpLedger();
    process.env.GENOME_V1_CAP_AUD = "0.01";
    try {
      await expect(classifyCatalogue({ storeUrl, catalogue, provider, ledger })).rejects.toBeInstanceOf(OverBudgetError);
      expect(provider.calls).toBe(0);
    } finally {
      delete process.env.GENOME_V1_CAP_AUD;
    }
  });

  it("records measured spend in the ledger and projects a catalogue", async () => {
    const ledger = await tmpLedger();
    const result = await classifyCatalogue({ storeUrl, catalogue, provider: paidFake(), ledger, limit: 2 });
    const written = JSON.parse(await readFile(ledger.file, "utf8"));
    expect(written.entries).toHaveLength(1);
    expect(written.entries[0].requests).toBe(10);
    expect(result.usd).toBeCloseTo(usdFor("claude-sonnet-5", result.usage, "batch"));
    expect(result.usdPerProductRun).toBeCloseTo(result.usd / 10);
    expect(projectCatalogue(result.usdPerProductRun!, 5, 2000).usd).toBeCloseTo(result.usd * 1000);
  });

  it("counts failed and invalid runs, and measures against the runs that remain", async () => {
    let n = 0;
    const provider = paidFake({
      async classify(requests) {
        return requests.map((r) => {
          n += 1;
          if (n % 5 === 0) return { customId: r.customId, output: null, error: "refused", usage: null };
          if (n % 5 === 1) return { customId: r.customId, output: { nonsense: true }, error: null, usage: null };
          return { customId: r.customId, output: mockClassify(r.input), error: null, usage: null };
        });
      },
    });
    const result = await classifyCatalogue({ storeUrl, catalogue, provider, ledger: false, limit: 1 });
    expect(result.failedRuns).toHaveLength(2);
    const gift = result.values.find((v) => v.dimension === "gift_role")!;
    expect(gift.runAgreement).toBe("3/3");
    expect(gift.rawValue).toContain("3 of 5 runs valid");
  });
});

describe("usdFor", () => {
  it("prices a 1-hour cache write at twice input, and a 5-minute one at 1.25x", () => {
    const writes = (oneHour: number) => ({ inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 1_000_000, cacheWrite1hTokens: oneHour });
    expect(usdFor("claude-sonnet-5", writes(0), "standard")).toBeCloseTo(2 * 1.25);
    expect(usdFor("claude-sonnet-5", writes(1_000_000), "standard")).toBeCloseTo(2 * 2);
  });

  it("halves batch pricing and prices cache reads at a tenth", () => {
    const usage = { inputTokens: 1_000_000, outputTokens: 1_000_000, cacheReadTokens: 1_000_000, cacheWriteTokens: 0 };
    expect(usdFor("claude-sonnet-5", usage, "standard")).toBeCloseTo(2 + 10 + 0.2);
    expect(usdFor("claude-sonnet-5", usage, "batch")).toBeCloseTo((2 + 10 + 0.2) / 2);
    expect(() => usdFor("claude-unknown", usage, "batch")).toThrow();
  });
});

describe("the Anthropic classifier", () => {
  const message = (text: string, stop: string = "end_turn") =>
    ({
      model: "claude-sonnet-5",
      stop_reason: stop,
      content: [{ type: "text", text }],
      usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 2000, cache_creation_input_tokens: 0 },
    }) as unknown as Anthropic.Message;

  it("warms the cache with the first request, batches the rest, and keys results by custom_id, not position", async () => {
    const created: { requests: { custom_id: string; params: Anthropic.MessageCreateParamsNonStreaming }[] }[] = [];
    const direct: Anthropic.MessageCreateParamsNonStreaming[] = [];
    let polls = 0;
    const client = {
      messages: {
        create: async (body: Anthropic.MessageCreateParamsNonStreaming) => {
          direct.push(body);
          return message(JSON.stringify({ gift_role: "novelty" }));
        },
        batches: {
          create: async (body: (typeof created)[number]) => {
            created.push(body);
            return { id: "b1", processing_status: "in_progress", request_counts: {} };
          },
          retrieve: async () => ({ id: "b1", processing_status: ++polls < 2 ? "in_progress" : "ended", request_counts: { succeeded: 2, processing: 0, errored: 0 } }),
          results: async () =>
            (async function* () {
              // Deliberately out of order.
              yield { custom_id: "p0-r2", result: { type: "errored", error: { type: "overloaded_error" } } };
              yield { custom_id: "p0-r1", result: { type: "succeeded", message: message(JSON.stringify({ gift_role: "practical" })) } };
            })(),
        },
      },
    } as unknown as Anthropic;

    const provider = createAnthropicClassifier({ mode: "batch", client, sleep: async () => {} });
    const input = classifierInput(catalogue.products[0]!);
    const out = await provider.classify([
      { customId: "p0-r0", input },
      { customId: "p0-r1", input },
      { customId: "p0-r2", input },
    ]);

    // The first request went direct, alone, before the batch existed.
    expect(direct).toHaveLength(1);
    expect(created[0]!.requests.map((r) => r.custom_id)).toEqual(["p0-r1", "p0-r2"]);
    expect(out.map((r) => r.customId)).toEqual(["p0-r0", "p0-r1", "p0-r2"]);
    expect(out[0]).toMatchObject({ output: { gift_role: "novelty" }, billing: "standard" });
    expect(out[1]!.output).toEqual({ gift_role: "practical" });
    expect(out[2]!.error).toBe("batch errored");

    // The same prefix, with the 1-hour TTL, in the warm-up and in the batch,
    // or the batch would miss the entry the warm-up wrote.
    const batched = created[0]!.requests[0]!.params;
    expect(batched.output_config?.format?.type).toBe("json_schema");
    expect(batched.system).toMatchObject([{ cache_control: { type: "ephemeral", ttl: "1h" } }]);
    expect(direct[0]!.system).toEqual(batched.system);
    expect(provider.billing).toBe("batch");
  });

  it("keeps the 5-minute cache for direct runs, where requests follow each other closely", async () => {
    const seen: Anthropic.MessageCreateParamsNonStreaming[] = [];
    const client = { messages: { create: async (b: Anthropic.MessageCreateParamsNonStreaming) => (seen.push(b), message("{}")) } } as unknown as Anthropic;
    await createAnthropicClassifier({ mode: "direct", client }).classify([{ customId: "a", input: classifierInput(catalogue.products[0]!) }]);
    expect(seen[0]!.system).toMatchObject([{ cache_control: { type: "ephemeral", ttl: "5m" } }]);
  });

  it("treats a refusal or a truncation as a failed run, never as an answer", async () => {
    const replies = [message("{}", "refusal"), message('{"gift', "max_tokens")];
    const client = { messages: { create: async () => replies.shift()! } } as unknown as Anthropic;
    const provider = createAnthropicClassifier({ mode: "direct", client, concurrency: 1 });
    const input = classifierInput(catalogue.products[0]!);
    const out = await provider.classify([
      { customId: "a", input },
      { customId: "b", input },
    ]);
    expect(out.map((r) => r.error)).toEqual(["refused", "hit max_tokens"]);
    expect(out.every((r) => r.output === null)).toBe(true);
  });
});
