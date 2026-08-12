/**
 * The JSON Schema handed to the model as `output_config.format`.
 *
 * Same two-schema arrangement as the merchandiser's: this one constrains what
 * the API will emit and its `description` fields are prompt surface — the model
 * reads them while filling each field, which is the highest-leverage place to
 * say what a good `problemSolved` is. `inference.ts` is the enforcement.
 *
 * `tests/genome-schema.test.ts` asserts the two agree, because two sources of
 * truth that drift are worse than one that is slightly wrong.
 *
 * Structured outputs do not support length or array-size constraints, so the
 * limits live in zod and are stated in prose here.
 */

type JsonSchema = Record<string, unknown>;

const object = (properties: Record<string, JsonSchema>, required: string[], description?: string): JsonSchema => ({
  type: "object",
  ...(description ? { description } : {}),
  properties,
  required,
  additionalProperties: false,
});

const PRODUCT_INFERENCE: JsonSchema = object(
  {
    handle: {
      type: "string",
      description: "The product's handle, copied exactly from the catalogue. One entry per catalogue product, in the order given.",
    },
    problemSolved: {
      type: "string",
      description:
        "What this product does for the person who buys it, in one clause under 160 characters. The job, not the features — 'keeps a hand warm without a glove's bulk', not 'merino wool, ribbed cuff'. If the listing genuinely does not say, describe the obvious use plainly rather than inventing a benefit.",
    },
    audience: {
      type: "string",
      description:
        "Who reaches for this, as a person rather than a demographic bucket. 'Someone buying their first proper knitwear' beats 'women 25-40'. Under 160 characters.",
    },
    occasions: {
      type: "array",
      items: { type: "string" },
      description:
        "Zero to three short lowercase phrases for when this gets bought — 'everyday', 'christmas', 'new home', 'first cold week'. Empty array when nothing specific applies; a forced occasion is worse than none.",
    },
    role: {
      type: "string",
      enum: ["hero", "supporting", "add-on"],
      description:
        "What this product can do on a page. 'hero' can carry a shop alone and survive being the first thing seen. 'supporting' earns a card beside something else. 'add-on' is what a shopper adds once they have already decided. Most catalogues have few heroes; resist making everything one.",
    },
    giftability: {
      type: "string",
      enum: ["high", "medium", "low"],
      description:
        "How well this works as a present for someone else. High means it needs no sizing, no personal fit and no prior knowledge of the recipient's taste.",
    },
    complements: {
      type: "array",
      items: { type: "string" },
      description:
        "Up to four handles, from this catalogue, that are used or bought *alongside* this one. This is the field that makes routines and bundles good rather than arbitrary. Empty array if nothing genuinely pairs.",
    },
    substitutes: {
      type: "array",
      items: { type: "string" },
      description:
        "Up to four handles, from this catalogue, a shopper would choose *between* rather than buy together — the same job at a different size, strength, colourway or price. Never list a handle in both complements and substitutes.",
    },
    confidence: {
      type: "string",
      enum: ["high", "medium", "low"],
      description:
        "How much the listing actually gave you. 'low' when the title is two words and there is no description — an honest 'low' is more useful than a confident guess, because the merchandiser can weight it down.",
    },
  },
  [
    "handle",
    "problemSolved",
    "audience",
    "occasions",
    "role",
    "giftability",
    "complements",
    "substitutes",
    "confidence",
  ],
  "One product's inferences. Everything here is a private read used to make merchandising decisions; none of it is shown to a shopper.",
);

export const GENOME_INFERENCE_SCHEMA: JsonSchema = object(
  {
    catalogueRead: {
      type: "string",
      description:
        "One sentence, under 240 characters, on what this store actually sells and to whom. The read a good buyer would give after ten minutes with the catalogue.",
    },
    products: {
      type: "array",
      items: PRODUCT_INFERENCE,
      description: "One entry per product in the catalogue, in the same order. Do not skip products and do not add any.",
    },
  },
  ["catalogueRead", "products"],
  "A private read of one merchant's catalogue, used to merchandise it. Never rendered.",
);
