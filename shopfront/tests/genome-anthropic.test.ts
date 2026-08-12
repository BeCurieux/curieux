/**
 * The Genome's request shape, and the three ways a response can arrive with no
 * catalogue read in it.
 *
 * Nothing here touches the network — the SDK client is faked. The merchandiser
 * has had this file since it was written; the Genome has not, and it makes the
 * same call with the same failure modes against a schema of its own.
 *
 * The caching assertion is the one that found something. A `cache_control`
 * breakpoint below its model's minimum prefix does not error and does not warn
 * — it silently does not cache, and the only symptom is a `cache_read_input_
 * tokens` that never leaves zero.
 */

import { describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { createAnthropicGenomeProvider } from "@/lib/genome/anthropic";
import { GenomeError } from "@/lib/genome/errors";
import { GENOME_INFERENCE_SCHEMA } from "@/lib/genome/inference-schema";
import { SYSTEM_PROMPT as GENOME_SYSTEM } from "@/lib/genome/prompt";
import { SYSTEM_PROMPT as MERCHANDISE_SYSTEM } from "@/lib/merchandise/prompt";
import { cachesOn } from "./helpers/cache-minimums";

const inference = { products: [] };

function fakeClient(response: Record<string, unknown>) {
  const create = vi.fn(async (_body: Record<string, any>) => ({
    stop_reason: "end_turn",
    model: "claude-sonnet-5",
    usage: { input_tokens: 9100, output_tokens: 2400 },
    content: [],
    ...response,
  }));
  return { client: { beta: { messages: { create } } } as unknown as Anthropic, create };
}

const textResponse = (text: string) => ({ content: [{ type: "text", text }] });

function request(corrections: { attempted: unknown; errors: string[] }[] = []) {
  // `handles` is what the validator checks the response against; the adapter
  // itself only forwards system, brief and corrections.
  return { system: "SYSTEM", brief: "BRIEF", handles: ["wool-throw"], corrections };
}

describe("the request", () => {
  it("carries the inference schema, the effort and the model", async () => {
    const { client, create } = fakeClient(textResponse(JSON.stringify(inference)));
    const provider = createAnthropicGenomeProvider({ client, model: "claude-sonnet-5", effort: "medium" });

    const result = await provider.read(request());

    const body = create.mock.calls[0]![0];
    expect(body.model).toBe("claude-sonnet-5");
    expect(body.output_config.format).toEqual({ type: "json_schema", schema: GENOME_INFERENCE_SCHEMA });
    expect(body.output_config.effort).toBe("medium");
    expect(result.inference).toEqual(inference);
    expect(result.usage).toEqual({ inputTokens: 9100, outputTokens: 2400 });
  });

  it("caches the catalogue, which a retry re-reads rather than re-pays for", async () => {
    const { client, create } = fakeClient(textResponse(JSON.stringify(inference)));
    await createAnthropicGenomeProvider({ client }).read(request());

    const body = create.mock.calls[0]![0];
    expect(body.messages[0].content[0].cache_control).toEqual({ type: "ephemeral" });
  });

  it("opts into the server-side fallback rather than surfacing a false refusal", async () => {
    const { client, create } = fakeClient(textResponse(JSON.stringify(inference)));
    await createAnthropicGenomeProvider({ client }).read(request());

    const body = create.mock.calls[0]![0];
    expect(body.fallbacks).toBe("default");
    expect(body.betas).toContain("server-side-fallback-2026-07-01");
  });

  it("replays the rejected read next to its errors", async () => {
    const { client, create } = fakeClient(textResponse(JSON.stringify(inference)));
    await createAnthropicGenomeProvider({ client }).read(
      request([{ attempted: { products: [] }, errors: ["missing entries for 4 products"] }]),
    );

    const body = create.mock.calls[0]![0];
    expect(body.messages).toHaveLength(3);
    expect(body.messages[1].role).toBe("assistant");
    expect(body.messages[2].content[0].text).toContain("missing entries for 4 products");
  });
});

describe("responses with no catalogue read in them", () => {
  it("names a refusal as a refusal", async () => {
    const { client } = fakeClient({
      stop_reason: "refusal",
      stop_details: { type: "refusal", category: "cyber", explanation: "declined" },
      content: [],
    });
    const error = await createAnthropicGenomeProvider({ client }).read(request()).catch((e: unknown) => e);
    expect((error as GenomeError).code).toBe("refused");
    expect((error as GenomeError).message).toContain("declined");
  });

  it("names a truncation as a truncation, with the ceiling that caused it", async () => {
    // Worth its own message: a truncated read returns half an object, and
    // `JSON.parse` would report a syntax error at some character offset rather
    // than "the catalogue did not fit".
    const { client } = fakeClient({ stop_reason: "max_tokens", content: [{ type: "text", text: '{"products":[' }] });
    const error = await createAnthropicGenomeProvider({ client, maxTokens: 32_000 })
      .read(request())
      .catch((e: unknown) => e);
    expect((error as GenomeError).code).toBe("truncated");
    expect((error as GenomeError).message).toContain("32000");
  });

  it("names a non-JSON body as unparseable", async () => {
    const { client } = fakeClient(textResponse("I read the catalogue and here is what I found:"));
    const error = await createAnthropicGenomeProvider({ client }).read(request()).catch((e: unknown) => e);
    expect((error as GenomeError).code).toBe("unparseable");
  });

  it("names an empty body rather than parsing it", async () => {
    const { client } = fakeClient({ stop_reason: "end_turn", content: [] });
    const error = await createAnthropicGenomeProvider({ client }).read(request()).catch((e: unknown) => e);
    expect((error as GenomeError).code).toBe("unparseable");
  });
});

describe("the system prompts against their models' cache minimums", () => {
  // These two assertions disagree on purpose, and the disagreement is the
  // finding. Both adapters put a breakpoint on their system prompt; only one
  // of the two prompts is long enough for its model to honour it.

  it("caches the merchandiser's system prompt on Opus", () => {
    const { ok, detail } = cachesOn(MERCHANDISE_SYSTEM, "claude-opus-5");
    expect(ok, detail).toBe(true);
  });

  it("does not cache the Genome's system prompt on Sonnet, and that is known", () => {
    // 2,621 characters is roughly 650–750 tokens, under Sonnet 5's 1,024-token
    // minimum however generously you count. The breakpoint in
    // `genome/anthropic.ts` is therefore inert.
    //
    // Left alone rather than "fixed", because the cost of the miss is about a
    // tenth of a cent per store and padding a prompt to reach a caching
    // threshold is the tail wagging the dog. What the Genome actually needs
    // cached is the catalogue, which is far larger and is cached — see above.
    //
    // This is written as a failing-if-it-changes assertion rather than a
    // comment so the day someone lengthens the prompt past the line, or moves
    // GENOME_MODEL to Opus 5 where the minimum is 512, this says so and the
    // breakpoint can start being believed.
    const { ok, detail } = cachesOn(GENOME_SYSTEM, "claude-sonnet-5");
    expect(ok, `the Genome system prompt now clears the bar — ${detail}`).toBe(false);
  });

  it("knows the minimum for every model either adapter defaults to", () => {
    // The guard against the real trap: the minimums are not monotonic, so
    // pointing GENOME_MODEL or AI_MODEL at an *older* model can raise the bar
    // eightfold. An unrecorded model fails here rather than silently caching
    // nothing.
    for (const model of ["claude-sonnet-5", "claude-opus-5"]) {
      const { detail } = cachesOn("x".repeat(100_000), model);
      expect(detail, detail).not.toContain("no recorded cache minimum");
    }
  });
});
