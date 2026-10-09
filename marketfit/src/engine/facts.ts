/**
 * What the engine knows about a product: a closed set of named facts.
 *
 * A closed set, because a rule that names a fact nobody ever extracts is a
 * rule that fails every product for a reason the merchant cannot fix. The
 * rule schema checks every fact key against this list, so a typo in a YAML
 * file fails the loader rather than flagging a whole catalogue.
 *
 * Each fact carries where it came from. A fact the model extracted is not a
 * fact until the merchant has confirmed it (BUILD_BRIEF.md §6.1): until then
 * the engine treats it as unknown, and a rule that depends on it reports
 * `not_assessed` rather than passing or failing on the model's say-so.
 */

import { z } from "zod";

export const Ingredient = z.object({
  name: z.string().min(1),
  /** Per serving, as declared. Absent when the label gives none. */
  amount: z.number().nonnegative().optional(),
  unit: z.string().min(1).optional(),
});
export type Ingredient = z.infer<typeof Ingredient>;

const text = z.string();
const list = z.array(z.string());

/**
 * Every fact key, with the shape its value must have.
 *
 * Booleans record presence on the physical label where the value itself is
 * printed at packing time (a lot code, a date) and the catalogue cannot know
 * it — the question the rule asks is "does the label carry one", not "which".
 */
export const FACT_SCHEMAS = {
  /** The legal name / designation as printed, e.g. "Food supplement". */
  product_name: text,
  ingredients: z.array(Ingredient),
  net_quantity: text,
  /** The recommended daily dose as printed, e.g. "2 capsules a day". */
  daily_dose: text,
  /** Servings per day at the recommended dose; what limit rules multiply by. */
  daily_servings: z.number().positive(),
  claims: list,
  warnings: list,
  /** All label and listing text, for statement and phrase matching. */
  label_text: text,
  manufacturer_name: text,
  manufacturer_address: text,
  responsible_person_name: text,
  responsible_person_address: text,
  adverse_event_contact: text,
  country_of_origin: text,
  /** ISO 639-1 codes of the languages the label is printed in. */
  languages: list,
  batch_code: z.union([z.boolean(), text]),
  best_before: z.union([z.boolean(), text]),
  nutrition_panel: z.union([z.boolean(), text]),
} as const;

export type FactKey = keyof typeof FACT_SCHEMAS;
export const FACT_KEYS = Object.keys(FACT_SCHEMAS) as FactKey[];
export const FactKeySchema = z.enum(FACT_KEYS as [FactKey, ...FactKey[]]);

export type FactValue<K extends FactKey> = z.infer<(typeof FACT_SCHEMAS)[K]>;

export const FACT_SOURCES = ["shopify", "label_upload", "merchant_input", "ai_extracted"] as const;
export type FactSource = (typeof FACT_SOURCES)[number];

export type Fact<K extends FactKey = FactKey> = {
  value: FactValue<K>;
  source: FactSource;
  /** 0–1, as reported by the extractor. Informational; never a gate. */
  confidence?: number;
  /** Merchant-confirmed. Required for `ai_extracted`; implied for the rest. */
  confirmed?: boolean;
};

export type ProductFacts = {
  productId: string;
  /** e.g. "supplements". Rules are selected by it. */
  category: string | null;
  facts: { [K in FactKey]?: Fact<K> };
};

/**
 * The value of a fact, or why there is none.
 *
 * `absent`: nobody has said anything — for a required field, that is the
 * finding. `unconfirmed`: the model said something and the merchant has not
 * agreed yet — the engine may not use it either way.
 */
export type FactRead<K extends FactKey> =
  | { state: "known"; value: FactValue<K>; source: FactSource }
  | { state: "absent" }
  | { state: "unconfirmed"; source: FactSource };

export function readFact<K extends FactKey>(product: ProductFacts, key: K): FactRead<K> {
  const fact = product.facts[key] as Fact<K> | undefined;
  if (!fact) return { state: "absent" };
  if (fact.source === "ai_extracted" && fact.confirmed !== true) return { state: "unconfirmed", source: fact.source };
  const parsed = FACT_SCHEMAS[key].safeParse(fact.value);
  // A value of the wrong shape is treated as absent rather than trusted: it
  // came from somewhere that did not validate, and guessing at it is how a
  // string "false" becomes a lot code.
  if (!parsed.success) return { state: "absent" };
  return { state: "known", value: parsed.data as FactValue<K>, source: fact.source };
}

/** Empty strings, empty lists and `false` are "not on the label". */
export function isEmptyValue(value: unknown): boolean {
  if (value === false || value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}
