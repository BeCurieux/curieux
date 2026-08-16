/**
 * The Anthropic provider.
 *
 * Structured outputs rather than tool use: the merchandiser produces exactly
 * one object, so `output_config.format` is the honest shape of the request —
 * a tool would be pretending there was a function to call. The JSON Schema in
 * `plan-schema.ts` goes on the request, which means the API itself enforces
 * the shape and the retry loop only ever has to deal with the failures a
 * schema cannot express (a handle that doesn't exist, a claim we can't back).
 */

import Anthropic from "@anthropic-ai/sdk";
import { MerchandiseError } from "./errors";
import { anthropicApiKey, MISSING_KEY } from "@/lib/anthropic-key";
import { MERCHANDISING_PLAN_SCHEMA } from "./plan-schema";
import type { GenerateRequest, GenerateResult, MerchandiseProvider } from "./provider";

export interface AnthropicProviderOptions {
  client?: Anthropic;
  apiKey?: string;
  model?: string;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  maxTokens?: number;
}

/**
 * Opus, not Sonnet.
 *
 * Merchandising is the product — it is the thing the brief says eliminates
 * page-building, and the difference between a good edit and a plausible one is
 * exactly the judgement the larger model has. `AI_MODEL` moves it if the
 * economics say otherwise; measure before you do.
 */
const DEFAULT_MODEL = "claude-opus-5";

/**
 * A single-shot generation, not an agentic loop — the API default (`high`) is
 * the right starting point. `AI_EFFORT=medium` is the latency lever if the
 * sixty-second bar in the definition of done starts to bite.
 */
const DEFAULT_EFFORT = "high" as const;

/** Comfortably above a ten-block plan, and under the SDK's non-streaming timeout. */
const DEFAULT_MAX_TOKENS = 16_000;

export function createAnthropicProvider(options: AnthropicProviderOptions = {}): MerchandiseProvider {
  const model = options.model ?? process.env.AI_MODEL ?? DEFAULT_MODEL;
  const effort = options.effort ?? (process.env.AI_EFFORT as AnthropicProviderOptions["effort"]) ?? DEFAULT_EFFORT;
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;

  const apiKey = options.apiKey ?? anthropicApiKey();
  if (!options.client && !apiKey) {
    throw new MerchandiseError("no-api-key", MISSING_KEY);
  }
  const client = options.client ?? new Anthropic({ apiKey });

  return {
    name: `anthropic:${model}`,

    async generate(request: GenerateRequest): Promise<GenerateResult> {
      const response = await client.beta.messages.create({
        model,
        max_tokens: maxTokens,
        // A policy decline on a merchandising prompt would be a false
        // positive, but it is a false positive that returns HTTP 200 with an
        // empty body — cheaper to let the server re-serve it than to hand the
        // merchant an unexplained failure.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: {
          effort,
          format: { type: "json_schema", schema: MERCHANDISING_PLAN_SCHEMA },
        },
        system: [
          // The system prompt is byte-identical across every store, so this
          // breakpoint is read on the second generation and every one after.
          { type: "text", text: request.system, cache_control: { type: "ephemeral" } },
        ],
        messages: buildMessages(request),
      });

      // `stop_reason` first: on a refusal `content` is empty, and on a
      // truncation it holds a half-written object that would fail to parse
      // with a much less useful message than "the plan ran out of room".
      if (response.stop_reason === "refusal") {
        throw new MerchandiseError(
          "refused",
          `The model declined this request${response.stop_details?.explanation ? `: ${response.stop_details.explanation}` : "."}`,
        );
      }
      if (response.stop_reason === "max_tokens") {
        throw new MerchandiseError(
          "truncated",
          `The plan hit the ${maxTokens}-token ceiling before it finished. Raise maxTokens, or ask for a shorter shop.`,
        );
      }

      const text = response.content.find((block) => block.type === "text")?.text;
      if (!text) {
        throw new MerchandiseError("unparseable", `The response carried no text block (stop_reason: ${response.stop_reason}).`);
      }

      let plan: unknown;
      try {
        plan = JSON.parse(text);
      } catch (error) {
        throw new MerchandiseError(
          "unparseable",
          `The response was not JSON despite the schema: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      return {
        plan,
        model: response.model,
        usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
      };
    },
  };
}

/**
 * The brief once, then one turn per failed attempt.
 *
 * Handing back the rejected plan alongside its errors matters: without it the
 * model is guessing which of twelve products it invented, and tends to rewrite
 * the whole shop rather than fix the one handle.
 */
function buildMessages(request: GenerateRequest): Anthropic.Beta.BetaMessageParam[] {
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: "user",
      content: [
        // Stable for the whole generation, so retries re-read it rather than
        // re-paying for a catalogue that has not changed.
        { type: "text", text: request.brief, cache_control: { type: "ephemeral" } },
      ],
    },
  ];

  for (const correction of request.corrections) {
    messages.push({ role: "assistant", content: [{ type: "text", text: JSON.stringify(correction.attempted) }] });
    messages.push({
      role: "user",
      content: [
        {
          type: "text",
          text: [
            "That plan was rejected. Fix exactly these problems and return the whole plan again:",
            "",
            ...correction.errors.map((error) => `- ${error}`),
            "",
            "Everything else in the plan was fine — keep it.",
          ].join("\n"),
        },
      ],
    });
  }

  return messages;
}
