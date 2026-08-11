/**
 * The Anthropic provider for the Genome.
 *
 * One pass over the whole catalogue, per CLAUDE.md — not one call per product.
 * That is not only a cost decision: the relationship graph is the most valuable
 * thing the pass produces, and a model looking at one product at a time cannot
 * produce one. Complements and substitutes only exist in the context of the
 * catalogue they are drawn from.
 */

import Anthropic from "@anthropic-ai/sdk";
import { GenomeError } from "./errors";
import { GENOME_INFERENCE_SCHEMA } from "./inference-schema";
import type { GenomeProvider, GenomeRequest, GenomeResult } from "./provider";

export interface GenomeAnthropicOptions {
  client?: Anthropic;
  apiKey?: string;
  model?: string;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  maxTokens?: number;
}

/**
 * Sonnet, not Opus — the one place in the pipeline where that is the right call.
 *
 * The merchandiser makes a judgement about taste and gets Opus. This makes a
 * structured read of text that is already in front of it, over up to 160
 * products, and it runs once per store rather than once per shop. Reading a
 * catalogue accurately is a job the smaller model does well, and the cost
 * difference over a long catalogue is the difference between enriching every
 * store and enriching the ones we remember to.
 *
 * `GENOME_MODEL` moves it. If the relationship graph ever looks arbitrary on
 * real catalogues, this is the first thing to change.
 */
const DEFAULT_MODEL = "claude-sonnet-5";

/** A long structured read rather than a hard problem. */
const DEFAULT_EFFORT = "medium" as const;

/** ~70 output tokens per product across a 160-product ceiling, with headroom. */
const DEFAULT_MAX_TOKENS = 32_000;

export function createAnthropicGenomeProvider(options: GenomeAnthropicOptions = {}): GenomeProvider {
  const model = options.model ?? process.env.GENOME_MODEL ?? DEFAULT_MODEL;
  const effort = options.effort ?? (process.env.GENOME_EFFORT as GenomeAnthropicOptions["effort"]) ?? DEFAULT_EFFORT;
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;

  const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!options.client && !apiKey) {
    throw new GenomeError(
      "no-api-key",
      "ANTHROPIC_API_KEY is not set. Set it, or run with AI_PROVIDER=mock for the deterministic catalogue read.",
    );
  }
  const client = options.client ?? new Anthropic({ apiKey });

  return {
    name: `anthropic:${model}`,

    async read(request: GenomeRequest): Promise<GenomeResult> {
      const response = await client.beta.messages.create({
        model,
        max_tokens: maxTokens,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: {
          effort,
          format: { type: "json_schema", schema: GENOME_INFERENCE_SCHEMA },
        },
        system: [{ type: "text", text: request.system, cache_control: { type: "ephemeral" } }],
        messages: buildMessages(request),
      });

      if (response.stop_reason === "refusal") {
        throw new GenomeError(
          "refused",
          `The model declined to read this catalogue${response.stop_details?.explanation ? `: ${response.stop_details.explanation}` : "."}`,
        );
      }
      if (response.stop_reason === "max_tokens") {
        throw new GenomeError(
          "truncated",
          `The catalogue read hit the ${maxTokens}-token ceiling. Raise maxTokens, or lower maxProducts so the pass covers fewer products and says so.`,
        );
      }

      const text = response.content.find((block) => block.type === "text")?.text;
      if (!text) {
        throw new GenomeError("unparseable", `The response carried no text block (stop_reason: ${response.stop_reason}).`);
      }

      let inference: unknown;
      try {
        inference = JSON.parse(text);
      } catch (error) {
        throw new GenomeError(
          "unparseable",
          `The response was not JSON despite the schema: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      return {
        inference,
        model: response.model,
        usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
      };
    },
  };
}

function buildMessages(request: GenomeRequest): Anthropic.Beta.BetaMessageParam[] {
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: "user",
      // The catalogue is the expensive part and does not change between
      // attempts, so a retry re-reads it rather than re-paying for it.
      content: [{ type: "text", text: request.brief, cache_control: { type: "ephemeral" } }],
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
            "That read was rejected. Fix exactly these problems and return the whole analysis again:",
            "",
            ...correction.errors.map((error) => `- ${error}`),
            "",
            "Everything else was fine — keep it.",
          ].join("\n"),
        },
      ],
    });
  }

  return messages;
}
