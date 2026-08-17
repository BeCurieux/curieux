/**
 * The JSON Schema handed to the model as `output_config.format`.
 *
 * Two schemas describe the same object, on purpose. This one is the *contract*
 * — it constrains what the API will emit at all, and its `description` fields
 * are prompt surface: the model reads them while filling each field, which is
 * the highest-leverage place to say what a good `blurb` or `headline` is.
 * `plan.ts` is the *enforcement* — zod, derived from `schema.ts`.
 *
 * Two sources of truth is a real risk, so `tests/plan-schema.test.ts` asserts
 * they agree: same block types, same enum members, same required fields, and a
 * plan valid under one validates under the other.
 *
 * Structured outputs do not support length, numeric or array-size constraints
 * (`maxLength`, `minimum`, `maxItems`). Those limits are real — they live in
 * `schema.ts` — so they are stated in prose here and in the system prompt, and
 * enforced by zod. A violation is a validation error the retry loop feeds back.
 *
 * `format` is the same story, for a harder reason. `format: "uri"` and
 * `format: "date-time"` each compile to a large regex inside the constrained
 * grammar, and five of them between them put this schema over the API's
 * grammar budget — the request is rejected outright with "the compiled grammar
 * is too large", before the model ever sees it. Since the schema is only sent
 * whole, that made every real merchandising call fail; the deterministic
 * fallback provider was the only thing that had ever answered.
 *
 * Dropping them costs nothing. A URL is never checked for being URL-shaped: it
 * is checked against `allowedUrls`, the closed set of URLs read off this store,
 * which is strictly stronger than `format: "uri"` and is where the real risk
 * lives — a well-formed URL pointing somewhere the merchant does not own is
 * exactly the failure `validate.ts` exists to catch. `launchesAt` is likewise
 * checked against the merchant's own brief. Say it in prose, enforce it in zod
 * and `validate.ts`, and keep the grammar compilable.
 *
 * `tests/plan-schema.test.ts` asserts no `format` reappears.
 */

type JsonSchema = Record<string, unknown>;

const object = (
  properties: Record<string, JsonSchema>,
  required: string[],
  description?: string,
): JsonSchema => ({
  type: "object",
  ...(description ? { description } : {}),
  properties,
  required,
  additionalProperties: false,
});

const PRODUCT_REF: JsonSchema = object(
  {
    handle: {
      type: "string",
      description:
        "The product's handle, copied exactly from the catalogue. Never invent one.",
    },
    blurb: {
      type: "string",
      description:
        "Optional. One clause of merchandising copy for this card — why this product, for this shopper. Under 120 characters. Never mention price, stock, ratings or reviews.",
    },
    leadImageIndex: {
      type: "integer",
      description:
        "Optional. Which of the product's images to lead with, 0-based, within the image count shown in the catalogue. Omit unless a later image is clearly the better hero.",
    },
    variantId: {
      type: "string",
      description:
        "Optional. Pin a specific variant, copied from the catalogue's variant list. Use only to honour an explicit constraint, e.g. the size that comes in under a price cap. Omit otherwise.",
    },
  },
  ["handle"],
  "A reference to one catalogue product. The renderer resolves its live price, availability and imagery at render time.",
);

const HERO: JsonSchema = object(
  {
    type: { const: "hero" },
    headline: {
      type: "string",
      description:
        "The first thing the shopper reads. Five to nine words. Under 80 characters. Speak to the audience the merchant described, in the brand's own register.",
    },
    subline: {
      type: "string",
      description: "Optional. One supporting line, under 140 characters. Omit if the headline stands alone.",
    },
    media: {
      description:
        "Optional but strongly preferred. A product photograph usually beats a logo as the hero image.",
      anyOf: [
        object(
          {
            kind: { const: "productImage" },
            handle: { type: "string", description: "A catalogue handle." },
            imageIndex: { type: "integer", description: "0-based index into that product's images." },
          },
          ["kind", "handle", "imageIndex"],
        ),
        object(
          {
            kind: { const: "brandAsset" },
            url: {
              type: "string",
              description:
                "An absolute URL, copied exactly from the brand image URLs listed in the brief. Never any other URL.",
            },
          },
          ["kind", "url"],
        ),
      ],
    },
    cta: object(
      {
        label: { type: "string", description: "Under 30 characters. Plain, e.g. 'Shop the edit'." },
        targetBlockId: { type: "string", description: "Optional. The id of a block further down this page." },
        url: {
          type: "string",
          description:
            "Optional. An absolute URL, copied exactly from the links listed in the brief. Prefer targetBlockId.",
        },
      },
      ["label"],
      "Optional. Include only when there is somewhere worth sending the shopper.",
    ),
  },
  ["type", "headline"],
  "The opening block. Use exactly one, first.",
);

const PRODUCT_GRID: JsonSchema = object(
  {
    type: { const: "productGrid" },
    title: { type: "string", description: "Optional. Under 60 characters. A section heading, not a sentence." },
    products: {
      type: "array",
      description: "One to twelve products, best first.",
      items: PRODUCT_REF,
    },
    layout: {
      description:
        "grid: four or more comparable products. carousel: a browsable set the shopper scans sideways on a phone. stack: one to three products that each deserve full width.",
      enum: ["grid", "carousel", "stack"],
    },
  },
  ["type", "products", "layout"],
  "The workhorse. Most shops are a hero plus one or two of these.",
);

const ROUTINE: JsonSchema = object(
  {
    type: { const: "routine" },
    title: { type: "string", description: "Under 60 characters." },
    steps: {
      type: "array",
      description:
        "Two to six ordered steps. Use only when order genuinely matters — a regimen, a set, a how-to-wear. Not as a prettier grid.",
      items: object(
        {
          label: { type: "string", description: "The step, under 40 characters, e.g. 'Step 1 — Cleanse'." },
          product: PRODUCT_REF,
        },
        ["label", "product"],
      ),
    },
  },
  ["type", "title", "steps"],
  "Ordered, step-labelled products: a routine, a gift set, a bundle.",
);

const DROP: JsonSchema = object(
  {
    type: { const: "drop" },
    title: { type: "string", description: "Under 60 characters." },
    products: { type: "array", description: "One to eight products.", items: PRODUCT_REF },
    launchesAt: {
      type: "string",
      description:
        "Optional. An ISO 8601 datetime, e.g. '2026-09-01T09:00:00Z'. Set this ONLY if the merchant's brief gives a launch date. Never guess one — the renderer counts down to it.",
    },
  },
  ["type", "title", "products"],
  "A launch or a new-in set. Use when the merchant frames something as new or upcoming.",
);

const OFFER: JsonSchema = object(
  {
    type: { const: "offer" },
    code: {
      type: "string",
      description:
        "A discount code, copied from the merchant's brief. If the brief contains no code, do not use this block at all.",
    },
    description: { type: "string", description: "What the code does, under 100 characters, in the merchant's own terms." },
  },
  ["type", "code", "description"],
  "Only ever when the merchant's brief supplies a code.",
);

const LINK_LIST: JsonSchema = object(
  {
    type: { const: "linkList" },
    links: {
      type: "array",
      description: "One to ten links, each with a URL taken from the links listed in the brief.",
      items: object(
        {
          label: { type: "string", description: "Under 40 characters." },
          url: {
            type: "string",
            description: "An absolute URL, copied exactly from the brief's link lists.",
          },
        },
        ["label", "url"],
      ),
    },
  },
  ["type", "links"],
  "The ordinary links, demoted to the bottom where they belong. At most one, last.",
);

const THEME: JsonSchema = object(
  {
    colorway: object(
      {
        background: { type: "string", description: "CSS colour, e.g. #faf8f4." },
        surface: { type: "string", description: "CSS colour. Cards and panels — a small step off the background." },
        text: { type: "string", description: "CSS colour. Must reach 4.5:1 contrast against the background." },
        accent: { type: "string", description: "CSS colour. Buttons and rules. Must reach 3:1 against the background." },
      },
      ["background", "surface", "text", "accent"],
      "Start from the brand's suggested colourway. Change it only if the brief asks for a different feeling, and keep the contrast.",
    ),
    typography: {
      description: "The renderer owns the actual font stacks; this picks which one.",
      enum: ["editorial-serif", "modern-sans", "soft-rounded", "mono-utility"],
    },
    mood: {
      description: "Overall art direction. Read it off the brand's own voice, not off the product category.",
      enum: ["clean", "editorial", "playful", "luxe", "utility"],
    },
    density: { description: "How much air the layout gets.", enum: ["airy", "regular", "compact"] },
    cornerRadius: {
      description: "How hard the edges are. Follow the brand's own surfaces rather than the product category.",
      enum: ["none", "soft", "round"],
    },
  },
  ["colorway", "typography", "mood", "density", "cornerRadius"],
);

/** The whole plan. `MERCHANDISING_PLAN_SCHEMA` is what goes on the request. */
export const MERCHANDISING_PLAN_SCHEMA: JsonSchema = object(
  {
    audience: {
      type: "string",
      description:
        "One line on who this shop is for, in your own words, under 200 characters. Kept as provenance, not shown on the page.",
    },
    tagline: {
      type: "string",
      description:
        "Optional. A line under the brand name, under 100 characters. Omit to keep the brand's own tagline.",
    },
    theme: { ...THEME, description: "The design tokens the renderer maps onto its own system. You choose the direction; it owns the execution." },
    blocks: {
      type: "array",
      description:
        "One to ten blocks, in the order they appear. Three to six is the usual shape of a good shop: hero, one or two product blocks, and the link list last.",
      items: object(
        {
          id: {
            type: "string",
            description: "A short stable id, e.g. 'hero' or 'under-80'. Unique within the plan.",
          },
          block: {
            description: "Exactly one block.",
            anyOf: [HERO, PRODUCT_GRID, ROUTINE, DROP, OFFER, LINK_LIST],
          },
        },
        ["id", "block"],
      ),
    },
  },
  ["audience", "theme", "blocks"],
);
