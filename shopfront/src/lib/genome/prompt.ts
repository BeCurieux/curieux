/**
 * The Genome's system prompt and brief.
 *
 * The merchandiser's prompt is about taste. This one is about restraint: the
 * job is to read a catalogue accurately, not to sell it. Almost every failure
 * mode here is enthusiasm — a store of six identical candles coming back with
 * six heroes, an occasion invented for a screwdriver, a "complements" list that
 * is really just the six other things in the catalogue.
 *
 * The one rule stated hardest is that none of this is ever shown to anybody.
 * A model that thinks it is writing marketing copy writes marketing copy.
 */

import type { Catalogue, IngestedProduct } from "@/lib/ingest/types";
import type { BrandContext } from "@/lib/ingest/types";
import { promptFingerprint } from "@/lib/provenance";

export const SYSTEM_PROMPT = `You are reading a merchant's product catalogue so that a merchandiser can build shops from it later. You produce a private analysis. It is never shown to a shopper, never rendered on a page, and never quoted as copy.

Because nobody reads this but the merchandiser, write for accuracy rather than appeal. Plain, specific, unflattering where the truth is unflattering. Marketing language here is actively harmful: it becomes a decision the merchandiser makes for the wrong reason.

# What you are actually deciding

The single most valuable thing you produce is the relationship graph — complements and substitutes. Titles and prices are already in the catalogue; what is not there is which two products belong in the same routine, and which two are the same decision at different price points. A merchandiser that knows those builds a three-step routine that makes sense. One that does not is guessing at order.

The second most valuable is role. Most catalogues have two or three products that can carry a page and a long tail that cannot. Marking everything a hero destroys the field's usefulness — if a third of the catalogue is a hero, none of it is.

# Rules

- One entry per product in the catalogue, using the handle exactly as given, in the order given. Never skip, never add, never invent a handle.
- complements and substitutes may only contain handles from this catalogue, and never the product's own handle.
- A handle is either a complement or a substitute for a given product, never both. Things used together are not things chosen between.
- Never put a price, a currency amount, a rating, a review count or a stock level in any text field. You are looking at a snapshot; those change, and this analysis outlives it.
- Never claim the catalogue is synced, live or connected to anything.
- Do not describe the photographs. You have not seen them — image quality is measured separately from data you do not have.
- Do not rank or score products against each other beyond the role field.

# Inferring honestly

You are inferring from a title, a type, some tags and often a marketing description. That is enough for a plain read and not enough for certainty, and the confidence field is where you say which you have.

Where a listing is thin, prefer the obvious and general reading over an invented specific one. A product called "Oat Crew" in a knitwear store is a jumper in an oat colourway; it is not "designed for the transitional weeks of early autumn" unless something in the listing says so.

An empty occasions array is a good answer. Most products in most catalogues are bought for no occasion at all.`;

export interface GenomeBriefOptions {
  /** Hard cap on products handed to the model in one pass. */
  maxProducts?: number;
  maxDescriptionChars?: number;
}

export interface GenomeBrief {
  text: string;
  /** The products actually described to the model, in order. */
  products: IngestedProduct[];
  omitted: number;
  warnings: string[];
}

const DEFAULTS = {
  /**
   * One pass, per CLAUDE.md. At roughly 70 output tokens per product this sits
   * comfortably inside a 16k ceiling, and it matches the ingester's own
   * `FALLBACK_PRODUCT_LIMIT` so a catalogue that fit there fits here.
   */
  maxProducts: 160,
  maxDescriptionChars: 240,
} as const;

export function buildGenomeBrief(
  catalogue: Catalogue,
  brand: BrandContext,
  options: GenomeBriefOptions = {},
): GenomeBrief {
  const maxProducts = options.maxProducts ?? DEFAULTS.maxProducts;
  const maxDescriptionChars = options.maxDescriptionChars ?? DEFAULTS.maxDescriptionChars;

  const products = catalogue.products.slice(0, maxProducts);
  const omitted = catalogue.products.length - products.length;
  const warnings: string[] = [];

  if (omitted > 0) {
    // Said out loud rather than swallowed: a Genome covering 160 of 400
    // products is a different object from one covering all of them, and the
    // merchandiser is entitled to know which it has.
    warnings.push(
      `Genome covers ${products.length} of ${catalogue.products.length} products; ${omitted} were not enriched in this pass.`,
    );
  }

  const sections: string[] = [];

  sections.push(
    [
      "# The store",
      "",
      `Name: ${brand.name}`,
      ...(brand.tagline ? [`Tagline: ${brand.tagline}`] : []),
      ...(brand.description ? [`Describes itself as: ${brand.description}`] : []),
    ].join("\n"),
  );

  // Descriptions matter far more here than they do to the merchandiser: the
  // whole task is reading what a product is for, and the description is usually
  // the only place that is written down.
  sections.push(
    [
      "# The catalogue",
      "",
      `${products.length} products. Return exactly ${products.length} entries, in this order.`,
      "",
      products.map((product, index) => describe(product, index, maxDescriptionChars)).join("\n\n"),
    ].join("\n"),
  );

  return { text: sections.join("\n\n"), products, omitted, warnings };
}

function describe(product: IngestedProduct, index: number, maxDescriptionChars: number): string {
  const lines = [
    `${index + 1}. ${product.handle}`,
    `   title: ${product.title}`,
    ...(product.productType ? [`   type: ${product.productType}`] : []),
    ...(product.tags.length ? [`   tags: ${product.tags.slice(0, 10).join(", ")}`] : []),
  ];

  // Variant option names ("Size", "Strength", "Scent") are a strong signal for
  // substitutes without spending tokens on every value.
  const options = optionNames(product);
  if (options.length) lines.push(`   options: ${options.join(", ")}`);

  const description = clip(product.description, maxDescriptionChars);
  lines.push(`   description: ${description || "(none given)"}`);

  return lines.join("\n");
}

function optionNames(product: IngestedProduct): string[] {
  const names = new Set<string>();
  for (const variant of product.variants) {
    if (variant.title && variant.title !== "Default Title") names.add(variant.title);
    if (names.size >= 6) break;
  }
  return [...names];
}

function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * Which revision of the prompt above produced a given shop.
 *
 * Derived from the text rather than hand-set, so it cannot be edited without
 * changing — the failure a `PROMPT_VERSION = 3` constant has is somebody
 * editing the prompt and not bumping the number, which files every later
 * generation under the revision before it.
 */
export const PROMPT_VERSION = promptFingerprint(SYSTEM_PROMPT);
