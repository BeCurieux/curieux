/**
 * The POP brief: a merchant's sentence, made structured (HANDOFF §7 step 1).
 *
 * A POP is an audience, an objective and commercial rules attached to a live
 * catalogue. This is that, as data: `who`, `why`, `goal`, `rules`, and the
 * Genome concepts the selection should match. The merchant sees it before
 * anything is generated and can change it; the CLI writes it to a file for
 * exactly that.
 *
 * **Rules are read by code, not only by the model.** The price cap in "under
 * $120" is extracted here by a pattern the tests pin down, and the model's
 * reading is checked against it. If the two disagree the brief is refused
 * until a person confirms it. A per-item cap is a promise the page makes, and
 * the worst version of this product is one that quietly decided "$120" meant
 * something else. D4: a cap is per item unless the sentence says basket or
 * total.
 */

import { z } from "zod";
import { permittedValues, UNKNOWN, type ModelDimensionId } from "@/lib/genome/v1/taxonomy";

export const GOALS = ["conversion", "aov", "launch", "move_stock"] as const;
export type Goal = (typeof GOALS)[number];

/** The Genome dimensions a brief may target: the model-classified, global ones. */
export const TARGET_DIMENSIONS = [
  "occasion_fit",
  "audience_fit",
  "use_context",
  "gift_role",
  "seasonality",
  "item_type",
  "style_register",
] as const satisfies readonly ModelDimensionId[];
export type TargetDimension = (typeof TARGET_DIMENSIONS)[number];

const conceptValues = (dim: TargetDimension) => z.array(z.enum(permittedValues(dim).filter((v) => v !== UNKNOWN) as [string, ...string[]]));

export const PopRules = z.object({
  /** In the store's currency. Null when the sentence sets none. */
  priceMax: z.number().positive().nullable(),
  priceScope: z.enum(["per_item", "basket"]),
  /** Needs unit counts (Admin inventory, M0). Refused on the public path. */
  minUnits: z.number().int().positive().nullable(),
  /** Handles that must appear. The CLI's --lock; the sentence's named products once resolved. */
  includeHandles: z.array(z.string()),
  excludeHandles: z.array(z.string()),
  /** Needs shipping data nobody has in V1. Refused rather than ignored. */
  shipBy: z.string().nullable(),
  /** Needs cost per item (Admin, M0). Refused on the public path. */
  marginMin: z.number().min(0).max(1).nullable(),
});
export type PopRules = z.infer<typeof PopRules>;

export const PopBrief = z.object({
  sentence: z.string().min(1),
  who: z.object({
    audienceFit: conceptValues("audience_fit"),
    /** Free text, for the copy: "dads who boat". Never used to filter. */
    persona: z.string(),
  }),
  why: z.object({
    occasionFit: conceptValues("occasion_fit"),
    campaign: z.string().nullable(),
  }),
  goal: z.enum(GOALS),
  rules: PopRules,
  /** Concepts to score against, per dimension. Who and why are folded in by `targetsOf`. */
  targets: z.object(Object.fromEntries(TARGET_DIMENSIONS.map((d) => [d, conceptValues(d)])) as Record<TargetDimension, ReturnType<typeof conceptValues>>),
  /** Product names the sentence mentioned, before they are resolved to handles. */
  mentions: z.array(z.string()),
  /**
   * Where each rule came from. `model` alone means no pattern in the sentence
   * backed it, e.g. "a hundred and twenty dollars", and a person has to
   * confirm it before it binds.
   */
  ruleSource: z.object({ priceMax: z.enum(["pattern", "pattern+model", "model", "merchant", "none"]) }),
});
export type PopBrief = z.infer<typeof PopBrief>;

/** Every concept the brief targets, who and why included, as `dimension:value`. */
export function targetsOf(brief: PopBrief): Map<TargetDimension, Set<string>> {
  const out = new Map<TargetDimension, Set<string>>();
  for (const dim of TARGET_DIMENSIONS) out.set(dim, new Set(brief.targets[dim]));
  for (const v of brief.who.audienceFit) out.get("audience_fit")!.add(v);
  for (const v of brief.why.occasionFit) out.get("occasion_fit")!.add(v);
  return out;
}

// --------------------------------------------------------- price, by pattern

export interface PriceCap {
  amount: number;
  scope: "per_item" | "basket";
  /** The words it came from, for the brief chips. */
  text: string;
}

const CURRENCY = String.raw`(?:[$£€¥₹]|a\$|au\$|us\$|nz\$|c\$|aud\s?|usd\s?|gbp\s?|eur\s?|nzd\s?)?`;
const AMOUNT = String.raw`(\d[\d,]*(?:\.\d{1,2})?)`;
/** "up to 5 products", "under 3 days": a number that counts something else is not a price. */
const NOT_MONEY = String.raw`(?!\s*(?:items?|products?|pieces?|things|picks|days?|weeks?|months?|hours?|%|percent|units?|skus?|people|kids)\b)`;
const BEFORE = new RegExp(String.raw`\b(?:under|below|beneath|less than|up to|no more than|at most|max(?:imum)?|cheaper than)\s+${CURRENCY}\s?${AMOUNT}\b${NOT_MONEY}`, "i");
const AFTER = new RegExp(String.raw`${CURRENCY}\s?${AMOUNT}\s+(?:or less|or under|and under|max(?:imum)?|or below)\b`, "i");
const BASKET = /\b(?:in total|total|basket|all together|altogether|combined|for everything|whole (?:order|shop))\b/i;

/**
 * A price cap from the sentence, or null. Deliberately narrow: it reads the
 * forms merchants write ("under $120", "$50 or less", "up to £80") and
 * nothing cleverer. A cap it cannot read is left to the model and then to a
 * person, which is the right failure.
 */
export function extractPriceCap(sentence: string): PriceCap | null {
  const match = BEFORE.exec(sentence) ?? AFTER.exec(sentence);
  if (!match?.[1]) return null;
  const amount = Number.parseFloat(match[1].replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const scope = BASKET.test(sentence) ? "basket" : "per_item";
  return { amount, scope, text: match[0].trim() };
}

// -------------------------------------------------------------- enforceable

export class BriefError extends Error {}

/**
 * Rules the engine cannot check on the public path are refused, not ignored.
 * A POP that says it respects a margin floor it never looked at is worse than
 * one that asks the merchant to take the rule out.
 */
export function unenforceable(brief: PopBrief, facts: { hasUnits: boolean; hasCost: boolean }): string[] {
  const out: string[] = [];
  if (brief.rules.minUnits !== null && !facts.hasUnits) out.push(`"at least ${brief.rules.minUnits} in stock" needs unit counts, which only the installed app can read (M0).`);
  if (brief.rules.marginMin !== null && !facts.hasCost) out.push(`a margin floor of ${Math.round(brief.rules.marginMin * 100)}% needs cost per item, which only the installed app can read (M0).`);
  if (brief.rules.shipBy !== null) out.push(`"ships by ${brief.rules.shipBy}" needs shipping data POPUUP does not have in V1.`);
  if (brief.rules.priceMax !== null && brief.rules.priceScope === "basket") out.push("a basket or total price cap needs a bundle builder V1 does not have; per-item caps are supported.");
  if (brief.ruleSource.priceMax === "model") out.push(`the price cap of ${brief.rules.priceMax} was read by the model, not found in the sentence; confirm it by editing the brief.`);
  return out;
}
