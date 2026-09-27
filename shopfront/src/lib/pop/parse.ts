/**
 * Sentence → POP brief.
 *
 * The model reads the sentence into the taxonomy's own words: "dads who boat"
 * becomes `audience_fit:men`, `occasion_fit:fathers_day` and
 * `use_context:water_coastal`, from the permitted values and nothing else. The
 * price cap is then settled by code (`brief.ts`), and the result is a draft
 * for the merchant to check, not an instruction yet.
 *
 * The model sees the sentence and the taxonomy. It is not shown the catalogue:
 * the brief says what the merchant asked for, and what the store can supply is
 * the filter's and the scorer's business. Named products come back as
 * mentions and are resolved against real titles in code.
 */

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { anthropicApiKey, MISSING_KEY } from "@/lib/anthropic-key";
import { hashOf } from "@/lib/genome/v1/inputs";
import { dimension, permittedValues, UNKNOWN } from "@/lib/genome/v1/taxonomy";
import { extractPriceCap, GOALS, PopBrief, TARGET_DIMENSIONS, type TargetDimension } from "./brief";

/** What a parser returns before code settles the rules. */
export interface BriefDraft {
  persona: string;
  campaign: string | null;
  goal: (typeof GOALS)[number];
  priceMax: number | null;
  priceScope: "per_item" | "basket";
  minUnits: number | null;
  shipBy: string | null;
  marginMin: number | null;
  mentions: string[];
  targets: Record<TargetDimension, string[]>;
}

export interface BriefParser {
  readonly name: string;
  parse(sentence: string): Promise<BriefDraft>;
}

const values = (dim: TargetDimension) => permittedValues(dim).filter((v) => v !== UNKNOWN);

export const BRIEF_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["persona", "campaign", "goal", "price_max", "price_scope", "min_units", "ship_by", "margin_min", "mentions", ...TARGET_DIMENSIONS],
  properties: {
    persona: { type: "string", description: "Who the shop is for, in the merchant's own words where possible: 'dads who boat'. Under 80 characters." },
    campaign: { type: ["string", "null"], description: "The campaign or moment, if named: 'Father's Day'. Null if none." },
    goal: {
      type: "string",
      enum: [...GOALS],
      description: "conversion unless the sentence asks otherwise: aov for bigger baskets or bundles, launch for new products or a drop, move_stock for clearing or overstock.",
    },
    price_max: { type: ["number", "null"], description: "A price ceiling the sentence states, as a number in the shop's currency. Null if none. Never invent one." },
    price_scope: { type: "string", enum: ["per_item", "basket"], description: "per_item unless the sentence says the total or the basket is capped." },
    min_units: { type: ["integer", "null"], description: "Minimum stock per product, only if stated." },
    ship_by: { type: ["string", "null"], description: "A delivery deadline, only if stated." },
    margin_min: { type: ["number", "null"], description: "A minimum margin as a fraction (0.5 = 50%), only if stated." },
    mentions: { type: "array", items: { type: "string" }, description: "Specific products the sentence names, in its words: 'the linen shirt'. Empty if none." },
    ...Object.fromEntries(
      TARGET_DIMENSIONS.map((dim) => [
        dim,
        {
          type: "array",
          items: { type: "string", enum: values(dim) },
          description: `${dimension(dim).question} Only values the sentence clearly implies; empty when it says nothing about this.`,
        },
      ]),
    ),
  },
};

const DraftSchema = z.object({
  persona: z.string(),
  campaign: z.string().nullable(),
  goal: z.enum(GOALS),
  price_max: z.number().positive().nullable(),
  price_scope: z.enum(["per_item", "basket"]),
  min_units: z.number().int().positive().nullable(),
  ship_by: z.string().nullable(),
  margin_min: z.number().min(0).max(1).nullable(),
  mentions: z.array(z.string()),
  ...Object.fromEntries(TARGET_DIMENSIONS.map((d) => [d, z.array(z.enum(values(d) as [string, ...string[]]))])),
});

export function draftFromJson(raw: unknown): BriefDraft {
  const d = DraftSchema.parse(raw) as z.infer<typeof DraftSchema> & Record<TargetDimension, string[]>;
  return {
    persona: d.persona.slice(0, 120),
    campaign: d.campaign,
    goal: d.goal,
    priceMax: d.price_max,
    priceScope: d.price_scope,
    minUnits: d.min_units,
    shipBy: d.ship_by,
    marginMin: d.margin_min,
    mentions: d.mentions,
    targets: Object.fromEntries(TARGET_DIMENSIONS.map((dim) => [dim, [...new Set(d[dim])]])) as Record<TargetDimension, string[]>,
  };
}

export const BRIEF_SYSTEM = [
  "You turn a merchant's one-sentence request for a campaign shop into a structured brief.",
  "Use only the permitted values. Record what the sentence says or directly implies, and nothing it merely suggests: 'dads' implies men, 'Father's Day' is fathers_day, 'who boat' is water_coastal. Do not infer seasonality, style_register, item_type or gift_role unless the sentence speaks to them; an empty list is the right answer for most dimensions of most sentences. Never invent a rule: a price, stock level, margin or deadline appears only if the merchant stated it.",
  "The concept values mean exactly what the merchandising taxonomy defines them to mean:",
  ...TARGET_DIMENSIONS.map((dim) => {
    const def = dimension(dim);
    return `- ${dim}: ${def.values.map((v) => `${v.id} (${v.definition})`).join("; ")}`;
  }),
].join("\n");

export const BRIEF_PROMPT_VERSION = `pop-brief-${hashOf({ system: BRIEF_SYSTEM, schema: BRIEF_SCHEMA })}`;

/**
 * Settle the draft into a brief. Code decides the price rule: the pattern,
 * where it found one, is what binds, and a model reading that disagrees with
 * it is an error rather than a vote.
 */
export function finaliseBrief(sentence: string, draft: BriefDraft): PopBrief {
  const cap = extractPriceCap(sentence);
  let priceMax = draft.priceMax;
  let priceScope = draft.priceScope;
  let source: PopBrief["ruleSource"]["priceMax"] = priceMax === null ? "none" : "model";
  if (cap) {
    if (draft.priceMax !== null && Math.abs(draft.priceMax - cap.amount) > 0.005) {
      throw new Error(`The sentence says "${cap.text}" but the brief read the cap as ${draft.priceMax}. Edit the brief to say which is meant.`);
    }
    priceMax = cap.amount;
    priceScope = cap.scope;
    source = draft.priceMax === null ? "pattern" : "pattern+model";
  }

  return PopBrief.parse({
    sentence: sentence.trim(),
    who: { audienceFit: draft.targets.audience_fit, persona: draft.persona },
    why: { occasionFit: draft.targets.occasion_fit, campaign: draft.campaign },
    goal: draft.goal,
    rules: {
      priceMax,
      priceScope,
      minUnits: draft.minUnits,
      includeHandles: [],
      excludeHandles: [],
      shipBy: draft.shipBy,
      marginMin: draft.marginMin,
    },
    targets: { ...draft.targets, audience_fit: [], occasion_fit: [] },
    mentions: draft.mentions,
    ruleSource: { priceMax: source },
  });
}

// --------------------------------------------------------------------- mock

const has = (s: string, ...words: string[]) => words.some((w) => new RegExp(`\\b${w}`, "i").test(s));

/** A keyword reading. Deterministic and free; the CLI says when it was used. */
export function createMockBriefParser(): BriefParser {
  return {
    name: "mock",
    async parse(sentence) {
      const t = Object.fromEntries(TARGET_DIMENSIONS.map((d) => [d, [] as string[]])) as Record<TargetDimension, string[]>;
      if (has(sentence, "father", "dad")) t.occasion_fit.push("fathers_day");
      if (has(sentence, "mother", "mum", "mom")) t.occasion_fit.push("mothers_day");
      if (has(sentence, "christmas", "holiday")) t.occasion_fit.push("christmas_holiday");
      if (has(sentence, "valentine")) t.occasion_fit.push("valentines");
      if (has(sentence, "birthday")) t.occasion_fit.push("birthday");
      if (has(sentence, "dad", "men", "him", "father")) t.audience_fit.push("men");
      if (has(sentence, "mum", "mom", "women", "her", "mother")) t.audience_fit.push("women");
      if (has(sentence, "boat", "sail", "beach", "surf", "fish")) t.use_context.push("water_coastal");
      if (has(sentence, "hike", "camp", "garden", "outdoor")) t.use_context.push("outdoor");
      if (has(sentence, "travel", "trip")) t.use_context.push("travel");
      if (has(sentence, "workshop", "diy", "trade", "tool")) t.use_context.push("work");
      if (has(sentence, "gift", "present") || t.occasion_fit.length) t.gift_role.push("practical");
      const goal = has(sentence, "clear", "overstock", "move stock") ? "move_stock" : has(sentence, "launch", "drop", "new arrival") ? "launch" : has(sentence, "bundle", "basket", "aov") ? "aov" : "conversion";
      const persona = /\bfor ([^.,]+?)(?:[.,]|\bunder\b|$)/i.exec(sentence)?.[1]?.trim() ?? "";
      return {
        persona,
        campaign: t.occasion_fit.includes("fathers_day") ? "Father's Day" : t.occasion_fit.includes("mothers_day") ? "Mother's Day" : null,
        goal,
        priceMax: null,
        priceScope: "per_item",
        minUnits: null,
        shipBy: null,
        marginMin: null,
        mentions: [],
        targets: t,
      };
    },
  };
}

// ---------------------------------------------------------------- anthropic

export function createAnthropicBriefParser(options: { client?: Anthropic; model?: string } = {}): BriefParser {
  const model = options.model ?? process.env.POP_BRIEF_MODEL ?? "claude-sonnet-5";
  const apiKey = anthropicApiKey();
  if (!options.client && !apiKey) throw new Error(MISSING_KEY);
  const client = options.client ?? new Anthropic({ apiKey });
  return {
    name: `anthropic:${model}`,
    async parse(sentence) {
      const response = await client.messages.create({
        model,
        max_tokens: 4_000,
        output_config: { effort: "low", format: { type: "json_schema", schema: BRIEF_SCHEMA } },
        system: BRIEF_SYSTEM,
        messages: [{ role: "user", content: `The merchant wrote:\n\n${sentence.trim()}` }],
      });
      if (response.stop_reason === "refusal") throw new Error("The model declined to read this brief.");
      if (response.stop_reason === "max_tokens") throw new Error("The brief read was cut off.");
      const text = response.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text;
      if (!text) throw new Error("The brief read came back empty.");
      return draftFromJson(JSON.parse(text));
    },
  };
}
