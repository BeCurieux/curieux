/**
 * Anthropic implementation of AIProvider (§12).
 *
 * All vendor specifics are confined to this file: the SDK import, the tool
 * shape used to force structured output, token accounting and pricing. The
 * planner imports AIProvider and never learns which model answered.
 *
 * Structured output is obtained by giving the model a single tool whose input
 * schema is the JSON Schema of our Zod contract and requiring its use. A
 * response that still fails validation is retried with the validation error
 * appended (§12), and every attempt is recorded (§43).
 */

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { createHash } from "node:crypto";
import type {
  AIProvider,
  AIProviderOptions,
  AIRunRecord,
  BundleSummary,
  CandidateSummary,
  HouseholdContext,
  WeekendContext,
} from "./provider";
import {
  candidateRankingSchema,
  feedbackSummarySchema,
  parseStructured,
  planCopySchema,
  planCritiqueSchema,
  planSelectionSchema,
  searchIntentsSchema,
  tasteInsightSchema,
  tasteModelUpdateSchema,
  tasteSummarySchema,
  type PlanCopy,
  type SearchIntent,
} from "./schemas";
import {
  CANDIDATE_RANKER_SYSTEM,
  FEEDBACK_SUMMARY_SYSTEM,
  PLAN_COPY_SYSTEM,
  PLAN_CRITIC_SYSTEM,
  PLAN_SELECTOR_SYSTEM,
  PROMPT_VERSIONS,
  SEARCH_INTENTS_SYSTEM,
  TASTE_INSIGHT_SYSTEM,
  TASTE_SUMMARY_SYSTEM,
  TASTE_UPDATE_SYSTEM,
  untrusted,
} from "./prompts";
import type { HouseholdMember, PlanFeedback } from "@/lib/types";

/** Approximate USD cents per million tokens. Used for the cost ledger (§43). */
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-5": { input: 500, output: 2500 },
  "claude-sonnet-5": { input: 300, output: 1500 },
  "claude-haiku-4-5-20251001": { input: 100, output: 500 },
};

const DEFAULT_PRICING = { input: 300, output: 1500 };

export class AnthropicAIProvider implements AIProvider {
  readonly name = "anthropic";
  readonly model: string;

  private readonly client: Anthropic;
  private readonly options: AIProviderOptions;

  constructor(apiKey: string, model: string, options: AIProviderOptions = {}) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
    this.options = options;
  }

  // ------------------------------------------------------------- operations

  async buildTasteSummary(input: {
    household: HouseholdContext;
    members: Array<Pick<HouseholdMember, "member_type" | "age">>;
    currency: string;
  }): Promise<string> {
    const result = await this.call({
      operation: "buildTasteSummary",
      promptVersion: PROMPT_VERSIONS.TASTE_SUMMARY,
      system: TASTE_SUMMARY_SYSTEM,
      schema: tasteSummarySchema,
      maxTokens: 400,
      user: [
        `Currency: ${input.currency}`,
        `Household: ${describeHousehold(input.household)}`,
        `Preferences: ${JSON.stringify(input.household.preferences)}`,
      ].join("\n\n"),
    });
    return result.summary;
  }

  async generateSearchIntents(input: {
    household: HouseholdContext;
    weekend: WeekendContext;
  }): Promise<SearchIntent[]> {
    const result = await this.call({
      operation: "generateSearchIntents",
      promptVersion: PROMPT_VERSIONS.SEARCH_INTENTS,
      system: SEARCH_INTENTS_SYSTEM,
      schema: searchIntentsSchema,
      maxTokens: 1600,
      user: [
        describeHousehold(input.household),
        describeWeekend(input.weekend),
        `Available category vocabulary: ${input.household.preferences.liked_categories.join(", ")}`,
      ].join("\n\n"),
    });
    return result.intents;
  }

  async rankCandidates(input: {
    household: HouseholdContext;
    weekend: WeekendContext;
    candidates: CandidateSummary[];
  }): Promise<Array<{ candidate_id: string; score: number; reason: string }>> {
    const result = await this.call({
      operation: "rankCandidates",
      promptVersion: PROMPT_VERSIONS.CANDIDATE_RANKER,
      system: CANDIDATE_RANKER_SYSTEM,
      schema: candidateRankingSchema,
      maxTokens: 2000,
      user: [
        describeHousehold(input.household),
        describeWeekend(input.weekend),
        `Candidates (facts from providers):\n${JSON.stringify(input.candidates, null, 1)}`,
      ].join("\n\n"),
    });
    return result.rankings;
  }

  async selectPlan(input: {
    household: HouseholdContext;
    weekend: WeekendContext;
    bundles: BundleSummary[];
  }) {
    return this.call({
      operation: "selectPlan",
      promptVersion: PROMPT_VERSIONS.PLAN_SELECTOR,
      system: PLAN_SELECTOR_SYSTEM,
      schema: planSelectionSchema,
      maxTokens: 1200,
      user: [
        describeHousehold(input.household),
        describeWeekend(input.weekend),
        `Assembled bundles:\n${JSON.stringify(input.bundles, null, 1)}`,
      ].join("\n\n"),
    });
  }

  async critiquePlan(input: {
    household: HouseholdContext;
    weekend: WeekendContext;
    bundle: BundleSummary;
  }) {
    return this.call({
      operation: "critiquePlan",
      promptVersion: PROMPT_VERSIONS.PLAN_CRITIC,
      system: PLAN_CRITIC_SYSTEM,
      schema: planCritiqueSchema,
      maxTokens: 1200,
      user: [
        describeHousehold(input.household),
        describeWeekend(input.weekend),
        `Plan under review:\n${JSON.stringify(input.bundle, null, 1)}`,
      ].join("\n\n"),
    });
  }

  async writePlanCopy(input: {
    household: HouseholdContext;
    weekend: WeekendContext;
    bundle: BundleSummary;
    fit_evidence: string[];
  }): Promise<PlanCopy> {
    return this.call({
      operation: "writePlanCopy",
      promptVersion: PROMPT_VERSIONS.PLAN_COPY,
      system: PLAN_COPY_SYSTEM,
      schema: planCopySchema,
      maxTokens: 1600,
      user: [
        describeHousehold(input.household),
        describeWeekend(input.weekend),
        `Fixed plan structure:\n${JSON.stringify(input.bundle, null, 1)}`,
        `Evidence the fit reason must be grounded in:\n${input.fit_evidence.map((e) => `- ${e}`).join("\n")}`,
      ].join("\n\n"),
    });
  }

  async summariseFeedback(input: {
    household: HouseholdContext;
    feedback: Pick<PlanFeedback, "did_it" | "rating" | "not_done_reason" | "note">;
    plan_summary: string;
  }) {
    const result = await this.call({
      operation: "summariseFeedback",
      promptVersion: PROMPT_VERSIONS.FEEDBACK_SUMMARY,
      system: FEEDBACK_SUMMARY_SYSTEM,
      schema: feedbackSummarySchema,
      maxTokens: 1000,
      user: [
        `Plan they were sent: ${input.plan_summary}`,
        `Did it: ${input.feedback.did_it}`,
        `Rating: ${input.feedback.rating ?? "none"}`,
        `Reason not done: ${input.feedback.not_done_reason ?? "n/a"}`,
        `Their words: ${untrusted(input.feedback.note)}`,
      ].join("\n"),
    });
    return result.signals;
  }

  async updateTasteModel(input: { household: HouseholdContext; recent_outcomes: string[] }) {
    const result = await this.call({
      operation: "updateTasteModel",
      promptVersion: PROMPT_VERSIONS.TASTE_UPDATE,
      system: TASTE_UPDATE_SYSTEM,
      schema: tasteModelUpdateSchema,
      maxTokens: 1600,
      user: [
        describeHousehold(input.household),
        `Recent outcomes:\n${input.recent_outcomes.map((o) => `- ${o}`).join("\n")}`,
      ].join("\n\n"),
    });
    return result.updates;
  }

  async tasteInsight(input: { household: HouseholdContext }): Promise<string | null> {
    const result = await this.call({
      operation: "tasteInsight",
      promptVersion: PROMPT_VERSIONS.TASTE_INSIGHT,
      system: TASTE_INSIGHT_SYSTEM,
      schema: tasteInsightSchema,
      maxTokens: 300,
      user: describeHousehold(input.household),
    });
    return result.insight;
  }

  // ------------------------------------------------------------- machinery

  /**
   * One structured call, with validation retries. The tool is named for the
   * operation so the model has a hint about intent beyond the schema alone.
   */
  private async call<T>(spec: {
    operation: string;
    promptVersion: string;
    system: string;
    schema: z.ZodType<T>;
    user: string;
    maxTokens: number;
  }): Promise<T> {
    const maxAttempts = this.options.maxAttempts ?? 3;
    const startedAt = Date.now();
    const validationErrors: string[] = [];

    let inputTokens = 0;
    let outputTokens = 0;
    let messages: Anthropic.MessageParam[] = [{ role: "user", content: spec.user }];

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: spec.maxTokens,
        system: spec.system,
        tools: [
          {
            name: "respond",
            description: `Return the ${spec.operation} result.`,
            input_schema: toJsonSchema(spec.schema),
          },
        ],
        tool_choice: { type: "tool", name: "respond" },
        messages,
      });

      inputTokens += response.usage.input_tokens;
      outputTokens += response.usage.output_tokens;

      const toolUse = response.content.find(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
      );

      if (toolUse) {
        const parsed = parseStructured(spec.schema, toolUse.input);
        if (parsed.ok) {
          await this.record({
            operation: spec.operation,
            promptVersion: spec.promptVersion,
            user: spec.user,
            output: parsed.value,
            latencyMs: Date.now() - startedAt,
            inputTokens,
            outputTokens,
            success: true,
            validationErrors,
            attempts: attempt,
          });
          return parsed.value;
        }
        validationErrors.push(parsed.error);

        // Feed the failure back so the retry is informed rather than a re-roll.
        messages = [
          ...messages,
          { role: "assistant", content: response.content },
          {
            role: "user",
            content: [
              {
                type: "tool_result" as const,
                tool_use_id: toolUse.id,
                is_error: true,
                content: `Schema validation failed: ${parsed.error}. Return a corrected result.`,
              },
            ],
          },
        ];
      } else {
        validationErrors.push("model did not call the tool");
      }
    }

    await this.record({
      operation: spec.operation,
      promptVersion: spec.promptVersion,
      user: spec.user,
      output: null,
      latencyMs: Date.now() - startedAt,
      inputTokens,
      outputTokens,
      success: false,
      validationErrors,
      attempts: maxAttempts,
    });

    throw new AIStructuredOutputError(spec.operation, validationErrors);
  }

  private async record(input: {
    operation: string;
    promptVersion: string;
    user: string;
    output: unknown;
    latencyMs: number;
    inputTokens: number;
    outputTokens: number;
    success: boolean;
    validationErrors: string[];
    attempts: number;
  }): Promise<void> {
    if (!this.options.sink) return;

    const pricing = PRICING[this.model] ?? DEFAULT_PRICING;
    const record: AIRunRecord = {
      provider: this.name,
      model: this.model,
      prompt_version: input.promptVersion,
      operation: input.operation,
      // A hash, not the prompt: the prompt contains household context and
      // operational logs are not the place for it (§43).
      input_hash: createHash("sha256").update(input.user).digest("hex").slice(0, 32),
      output: input.output,
      latency_ms: input.latencyMs,
      input_tokens: input.inputTokens,
      output_tokens: input.outputTokens,
      estimated_cost_cents:
        (input.inputTokens / 1_000_000) * pricing.input +
        (input.outputTokens / 1_000_000) * pricing.output,
      success: input.success,
      validation_errors: input.validationErrors,
      attempts: input.attempts,
      household_id: this.options.householdId ?? null,
      generation_run_id: this.options.generationRunId ?? null,
    };
    await this.options.sink(record);
  }
}

export class AIStructuredOutputError extends Error {
  constructor(
    readonly operation: string,
    readonly validationErrors: string[]
  ) {
    super(`AI ${operation} failed schema validation after retries: ${validationErrors.join(" | ")}`);
    this.name = "AIStructuredOutputError";
  }
}

/**
 * Zod → JSON Schema, covering the constructs our schemas actually use.
 *
 * A dependency could do this, but the subset is small, the output needs to be
 * exactly what the tools API accepts, and a hand-written converter fails
 * loudly on a construct it does not know rather than emitting something the
 * API will reject at runtime.
 */
export function toJsonSchema(schema: z.ZodTypeAny): Anthropic.Tool.InputSchema {
  const json = convert(schema);
  if (json.type !== "object") {
    throw new Error("Tool input schema must be an object at the root");
  }
  return json as Anthropic.Tool.InputSchema;
}

interface JsonSchemaNode {
  type?: string | string[];
  description?: string;
  properties?: Record<string, JsonSchemaNode>;
  required?: string[];
  items?: JsonSchemaNode;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  additionalProperties?: boolean;
}

function convert(schema: z.ZodTypeAny): JsonSchemaNode {
  const def = schema._def;

  switch (def.typeName) {
    case z.ZodFirstPartyTypeKind.ZodObject: {
      const shape = (schema as z.ZodObject<z.ZodRawShape>).shape;
      const properties: Record<string, JsonSchemaNode> = {};
      const required: string[] = [];
      for (const [key, value] of Object.entries(shape)) {
        properties[key] = convert(value);
        if (!value.isOptional()) required.push(key);
      }
      return { type: "object", properties, required, additionalProperties: false };
    }

    case z.ZodFirstPartyTypeKind.ZodArray: {
      const node: JsonSchemaNode = {
        type: "array",
        items: convert((schema as z.ZodArray<z.ZodTypeAny>).element),
      };
      const arrayDef = def as z.ZodArrayDef;
      if (arrayDef.minLength) node.minItems = arrayDef.minLength.value;
      if (arrayDef.maxLength) node.maxItems = arrayDef.maxLength.value;
      return node;
    }

    case z.ZodFirstPartyTypeKind.ZodString: {
      const node: JsonSchemaNode = { type: "string" };
      for (const check of (def as z.ZodStringDef).checks) {
        if (check.kind === "min") node.minLength = check.value;
        if (check.kind === "max") node.maxLength = check.value;
      }
      return node;
    }

    case z.ZodFirstPartyTypeKind.ZodNumber: {
      const numberDef = def as z.ZodNumberDef;
      const node: JsonSchemaNode = {
        type: numberDef.checks.some((c) => c.kind === "int") ? "integer" : "number",
      };
      for (const check of numberDef.checks) {
        if (check.kind === "min") node.minimum = check.value;
        if (check.kind === "max") node.maximum = check.value;
      }
      return node;
    }

    case z.ZodFirstPartyTypeKind.ZodBoolean:
      return { type: "boolean" };

    case z.ZodFirstPartyTypeKind.ZodEnum:
      return { type: "string", enum: [...(def as z.ZodEnumDef).values] };

    case z.ZodFirstPartyTypeKind.ZodNullable: {
      const inner = convert((schema as z.ZodNullable<z.ZodTypeAny>).unwrap());
      const type = inner.type;
      return {
        ...inner,
        type: Array.isArray(type) ? [...type, "null"] : type ? [type, "null"] : "null",
      };
    }

    case z.ZodFirstPartyTypeKind.ZodOptional:
      return convert((schema as z.ZodOptional<z.ZodTypeAny>).unwrap());

    case z.ZodFirstPartyTypeKind.ZodDefault:
      return convert((def as z.ZodDefaultDef).innerType);

    default:
      throw new Error(`toJsonSchema: unsupported Zod type ${String(def.typeName)}`);
  }
}

// ------------------------------------------------------------ context rendering

function describeHousehold(household: HouseholdContext): string {
  const lines = [
    `Household: ${household.shape}, ${household.adults} adult(s)`,
    household.children_ages.length > 0
      ? `Children aged: ${household.children_ages.join(", ")}`
      : "No children",
  ];
  if (household.mobility_notes.length > 0) {
    lines.push(`Mobility considerations: ${household.mobility_notes.map(untrusted).join(" ")}`);
  }

  const p = household.preferences;
  lines.push(
    `Travel tolerance: up to ${p.max_travel_minutes} minutes by ${p.transport_modes.join("/")}`,
    `Budget band: ${p.budget_band}`,
    `Activity now: ${p.activity_level}; wants: ${p.desired_activity_level}; nudge: ${p.nudge}`,
    `Likes: ${p.liked_categories.join(", ") || "unstated"}`,
    `Dislikes: ${p.dislikes.join(", ") || "none stated"}`,
    `Preferred start: ${p.start_time_preference}; usable time: ${p.time_budget}`,
    `Crowd tolerance: ${p.crowd_tolerance.toFixed(2)} (0 = avoids crowds)`,
    `Food: loves ${p.food.cuisines_loved.join(", ") || "unstated"}; dietary ${p.food.dietary_requirements.join(", ") || "none"}`
  );
  if (p.hard_no) lines.push(`Absolutely not: ${untrusted(p.hard_no)}`);

  if (household.taste_signals.length > 0) {
    lines.push(
      "Learned signals (behaviour, strongest first):",
      ...household.taste_signals
        .slice(0, 20)
        .map(
          (s) =>
            `  ${s.dimension}:${s.value} = ${s.weight >= 0 ? "+" : ""}${s.weight.toFixed(2)} (confidence ${s.confidence.toFixed(2)})`
        )
    );
  }
  if (household.recent_anchor_names.length > 0) {
    lines.push(`Recently suggested: ${household.recent_anchor_names.join("; ")}`);
  }
  if (household.completed_anchor_names.length > 0) {
    lines.push(`Actually did recently: ${household.completed_anchor_names.join("; ")}`);
  }
  return lines.join("\n");
}

function describeWeekend(weekend: WeekendContext): string {
  const lines = [
    `Weekend of ${weekend.weekend_date} in ${weekend.market_display_name} (${weekend.currency})`,
  ];
  if (weekend.weather) {
    const w = weekend.weather;
    lines.push(
      `Forecast (from ${w.provider}): ${w.summary}; ${w.temperature_min}–${w.temperature_max}°C, ` +
        `${Math.round(w.precipitation_probability * 100)}% chance of rain, ${w.precipitation_amount}mm, wind ${w.wind_speed} km/h`
    );
  } else {
    lines.push("Forecast: unavailable — do not make weather claims.");
  }
  if (weekend.energy || weekend.budget || weekend.time) {
    lines.push(
      `This week's check-in — energy: ${weekend.energy ?? "default"}, budget: ${weekend.budget ?? "default"}, time: ${weekend.time ?? "default"}`
    );
  }
  if (weekend.note) lines.push(`Note from the customer: ${untrusted(weekend.note)}`);
  return lines.join("\n");
}
