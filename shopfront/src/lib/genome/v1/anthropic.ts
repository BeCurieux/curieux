/**
 * The Anthropic classifier: one product per request, enum-constrained output.
 *
 * Two modes over the same request body:
 *
 * - `batch`, the Message Batches API, for catalogue ingest and the gold set
 *   (HANDOFF D5). Half price, asynchronous, usually done within the hour.
 *   Results come back in any order and are keyed by `custom_id`, never by
 *   position.
 * - `direct`, ordinary requests with a small concurrency limit, for a handful
 *   of products where waiting on a batch would be silly (one webhook's worth,
 *   or a smoke test).
 *
 * The system prompt is identical across every product and marked for caching,
 * so the taxonomy is paid for once per cache window rather than once per call.
 *
 * Sonnet 5 at low effort, matching the v0 Genome's reasoning that reading a
 * listing is not where the larger model earns its price. `GENOME_V1_MODEL` and
 * `GENOME_V1_EFFORT` move it, and the eval is how to tell whether they should.
 */

import Anthropic from "@anthropic-ai/sdk";
import { anthropicApiKey, MISSING_KEY } from "@/lib/anthropic-key";
import { CLASSIFICATION_SCHEMA } from "./classify-schema";
import { productText, SYSTEM_PROMPT } from "./prompt";
import type { ClassifierProvider, ClassifyRequest, RunResult, Usage } from "./provider";

export const DEFAULT_MODEL = "claude-sonnet-5";
type Effort = "low" | "medium" | "high" | "xhigh" | "max";
const DEFAULT_EFFORT: Effort = "low";

/** A classification is ~150 tokens; the rest is room for adaptive thinking. */
const MAX_TOKENS = 4_000;

/** Pre-flight allowance for one ~400px image; see `countInputTokens`. */
export const IMAGE_TOKEN_ALLOWANCE = 300;

export interface AnthropicClassifierOptions {
  mode: "batch" | "direct";
  client?: Anthropic;
  model?: string;
  effort?: Effort;
  /** Direct mode only. */
  concurrency?: number;
  /** Batch mode only; injectable so tests do not wait. */
  pollMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

export function createAnthropicClassifier(options: AnthropicClassifierOptions): ClassifierProvider {
  const model = options.model ?? process.env.GENOME_V1_MODEL ?? DEFAULT_MODEL;
  const effort = options.effort ?? (process.env.GENOME_V1_EFFORT as Effort | undefined) ?? DEFAULT_EFFORT;
  const apiKey = anthropicApiKey();
  if (!options.client && !apiKey) throw new Error(MISSING_KEY);
  const client = options.client ?? new Anthropic({ apiKey });
  const sleep = options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));

  /*
   * The taxonomy prompt is ~3.3k tokens and identical for every product, so
   * it should be written to the cache once and read by everything after.
   * The one-store run showed it was not: in a batch, requests run in
   * parallel and at times nobody controls, so 46 of 50 wrote their own copy,
   * and those writes were 80% of the bill.
   *
   * Two changes, from the prompt-caching guidance: batch requests use the
   * 1-hour TTL, because a batch can outlive the default 5 minutes, and the
   * first request is sent on its own before the batch, so the entry exists
   * before anything else asks for it. That first request is a real run, not
   * a throwaway: structured outputs rule out the zero-token warm-up call.
   */
  const ttl: "5m" | "1h" = options.mode === "batch" ? "1h" : "5m";
  const params = (input: ClassifyRequest["input"]): Anthropic.MessageCreateParamsNonStreaming => ({
    model,
    max_tokens: MAX_TOKENS,
    output_config: { effort, format: { type: "json_schema", schema: CLASSIFICATION_SCHEMA } },
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral", ttl } }],
    messages: [
      {
        role: "user",
        content: [
          ...(input.imageUrl ? [{ type: "image" as const, source: { type: "url" as const, url: input.imageUrl } }] : []),
          { type: "text" as const, text: productText(input) },
        ],
      },
    ],
  });

  return {
    name: `anthropic-${options.mode}:${model}`,
    model,
    billing: options.mode === "batch" ? "batch" : "standard",

    async countInputTokens(request) {
      // `count_tokens` refuses URL image sources ("URL image sources are not
      // supported"), though `messages.create` and batches accept them. So the
      // text is counted exactly and the image is added as an allowance: a
      // 400px product shot measured ~230 tokens, and 300 keeps the estimate
      // on the pessimistic side the cap wants.
      const { max_tokens: _m, ...rest } = params({ ...request.input, imageUrl: null });
      const counted = await client.messages.countTokens(rest as Anthropic.MessageCountTokensParams);
      return counted.input_tokens + (request.input.imageUrl ? IMAGE_TOKEN_ALLOWANCE : 0);
    },

    async classify(requests, onProgress) {
      if (options.mode === "direct") {
        const out: RunResult[] = new Array(requests.length);
        let next = 0;
        const worker = async () => {
          while (next < requests.length) {
            const i = next++;
            const request = requests[i]!;
            try {
              out[i] = fromMessage(request.customId, await client.messages.create(params(request.input)));
            } catch (error) {
              out[i] = failed(request.customId, error);
            }
          }
        };
        await Promise.all(Array.from({ length: Math.min(options.concurrency ?? 4, requests.length) }, worker));
        return out;
      }

      // Warm the cache with the first real request, then batch the rest.
      const [first, ...rest] = requests;
      let warmed: RunResult;
      try {
        warmed = { ...fromMessage(first!.customId, await client.messages.create(params(first!.input))), billing: "standard" };
      } catch (error) {
        warmed = failed(first!.customId, error);
      }
      onProgress?.(`cache warmed by ${first!.customId} (${warmed.usage?.cacheWriteTokens ?? 0} tokens written)`);
      if (rest.length === 0) return [warmed];

      const batch = await client.messages.batches.create({
        requests: rest.map((r) => ({ custom_id: r.customId, params: params(r.input) })),
      });
      onProgress?.(`batch ${batch.id} submitted: ${rest.length} requests`);

      let status = batch;
      while (status.processing_status !== "ended") {
        await sleep(options.pollMs ?? 30_000);
        status = await client.messages.batches.retrieve(batch.id);
        const c = status.request_counts;
        onProgress?.(`batch ${batch.id}: ${status.processing_status}, ${c.succeeded} done, ${c.processing} processing, ${c.errored} errored`);
      }

      const byId = new Map<string, RunResult>([[warmed.customId, warmed]]);
      for await (const entry of await client.messages.batches.results(batch.id)) {
        const result = entry.result;
        byId.set(
          entry.custom_id,
          result.type === "succeeded"
            ? fromMessage(entry.custom_id, result.message)
            : { customId: entry.custom_id, output: null, error: `batch ${result.type}`, usage: null },
        );
      }
      return requests.map((r) => byId.get(r.customId) ?? { customId: r.customId, output: null, error: "missing from batch results", usage: null });
    },
  };
}

function usageOf(message: Anthropic.Message): Usage {
  return {
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
    cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
    // Priced at 2x input rather than 1.25x; the ledger needs the split.
    cacheWrite1hTokens: message.usage.cache_creation?.ephemeral_1h_input_tokens ?? 0,
  };
}

function fromMessage(customId: string, message: Anthropic.Message): RunResult {
  const usage = usageOf(message);
  if (message.stop_reason === "refusal") return { customId, output: null, error: "refused", usage };
  if (message.stop_reason === "max_tokens") return { customId, output: null, error: "hit max_tokens", usage };
  const text = message.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text;
  if (!text) return { customId, output: null, error: `no text block (stop_reason ${message.stop_reason})`, usage };
  try {
    return { customId, output: JSON.parse(text), error: null, usage };
  } catch {
    return { customId, output: null, error: "not JSON despite the schema", usage };
  }
}

function failed(customId: string, error: unknown): RunResult {
  const message =
    error instanceof Anthropic.APIError ? `API ${error.status ?? "error"}: ${error.message}` : error instanceof Error ? error.message : String(error);
  return { customId, output: null, error: message, usage: null };
}
