import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { serverEnv } from "@/env";
import { MODULE_SCHEMAS, type ModuleKey } from "@/lib/domain/modules";
import { SYSTEM_PROMPT, userPrompt } from "./prompts";
import { GenerationError } from "./errors";
import type { AIProvider, GenerationInput, GenerationResult } from "./provider";

// Claude, through the official SDK, with structured outputs so the reply is
// JSON in the module's shape. The generation service still validates it with
// Zod and runs the claims guard: a schema constrains shape, not truth.
//
// Server-side fallback ("default") is on: if a request is declined by a
// safety classifier, the API retries it on a suitable model in the same
// call. A request the whole chain declines ends with stop_reason "refusal",
// which we report as a failed generation, never as content.

export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic" as const;
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly effort: "low" | "medium" | "high";
  private readonly timeout: number;

  constructor() {
    const env = serverEnv();
    this.client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1 });
    this.model = env.EMPIRE_AI_MODEL;
    this.effort = env.EMPIRE_AI_EFFORT;
    this.timeout = env.EMPIRE_AI_TIMEOUT_MS;
  }

  async generate<M extends ModuleKey>(input: GenerationInput<M>): Promise<GenerationResult<M>> {
    let response;
    try {
      response = await this.client.beta.messages.parse(
        {
          model: this.model,
          max_tokens: 16_000,
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
          messages: [{ role: "user", content: userPrompt(input) }],
          output_config: {
            effort: this.effort,
            format: zodOutputFormat(MODULE_SCHEMAS[input.module]),
          },
        },
        { timeout: this.timeout, signal: input.signal },
      );
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError) {
        throw new GenerationError("The writing service is busy. Try again in a minute.", undefined, true);
      }
      if (error instanceof Anthropic.APIConnectionTimeoutError || input.signal?.aborted) {
        throw new GenerationError("That took too long, so we stopped it. Try again.", undefined, true);
      }
      if (error instanceof Anthropic.InternalServerError || error instanceof Anthropic.APIConnectionError) {
        throw new GenerationError("The writing service had a hiccup. Try again.", undefined, true);
      }
      if (error instanceof Anthropic.APIError) {
        throw new GenerationError(`The writing service refused the request (${error.status ?? "error"}).`);
      }
      throw error;
    }

    const usage = {
      inputTokens:
        (response.usage.input_tokens ?? 0) +
        (response.usage.cache_creation_input_tokens ?? 0) +
        (response.usage.cache_read_input_tokens ?? 0),
      outputTokens: response.usage.output_tokens ?? 0,
    };

    if (response.stop_reason === "refusal") {
      throw new GenerationError("This request couldn't be completed. Try rewording your details.", usage);
    }
    if (response.stop_reason === "max_tokens") {
      throw new GenerationError("The result was too long and got cut off. Try again.", usage, true);
    }

    const text = response.content
      .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");
    let output: unknown;
    try {
      output = JSON.parse(text);
    } catch {
      throw new GenerationError("The result came back malformed. Try again.", usage, true);
    }
    return { output, model: response.model, usage };
  }
}
