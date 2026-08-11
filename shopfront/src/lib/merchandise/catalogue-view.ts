/**
 * The catalogue, as the model reads it.
 *
 * This is the largest thing in the request by far, and its shape is a direct
 * trade against the merchandiser's job: too little and it cannot select well
 * ("everything under £80" needs prices; "lead with the serum" needs titles and
 * types); too much and a thousand-product store costs more than the shop is
 * worth and pushes past the latency the brief asks for.
 *
 * So: one line per product, and detail that drops out in a stated order as the
 * catalogue grows. Nothing is silently omitted — every reduction is reported
 * back as a warning, because a shop merchandised from half a catalogue is a
 * different thing from a shop merchandised from all of it.
 */

import type { Catalogue, IngestedProduct } from "@/lib/ingest/types";

export interface CatalogueViewOptions {
  /** Hard cap on products handed to the model. */
  maxProducts?: number;
  /** Below this many products, each one gets a description. */
  descriptionsBelow?: number;
  maxDescriptionChars?: number;
}

export interface CatalogueView {
  text: string;
  included: number;
  omitted: number;
  descriptionsIncluded: boolean;
  warnings: string[];
}

const DEFAULTS = {
  maxProducts: 300,
  descriptionsBelow: 150,
  maxDescriptionChars: 180,
} as const;

export function renderCatalogue(catalogue: Catalogue, options: CatalogueViewOptions = {}): CatalogueView {
  const maxProducts = options.maxProducts ?? DEFAULTS.maxProducts;
  const descriptionsBelow = options.descriptionsBelow ?? DEFAULTS.descriptionsBelow;
  const maxDescriptionChars = options.maxDescriptionChars ?? DEFAULTS.maxDescriptionChars;

  const products = catalogue.products.slice(0, maxProducts);
  const omitted = catalogue.products.length - products.length;
  const withDescriptions = products.length < descriptionsBelow;
  const warnings: string[] = [];

  if (omitted > 0) {
    warnings.push(
      `Catalogue trimmed to ${products.length} of ${catalogue.products.length} products for the merchandiser; ${omitted} were not offered for selection.`,
    );
  }
  if (!withDescriptions && products.length > 0) {
    warnings.push(
      `${products.length} products is above the ${descriptionsBelow}-product threshold, so descriptions were dropped from the merchandiser's catalogue; selection is on title, type, tags and price only.`,
    );
  }

  const currency = catalogue.currency ?? "unstated currency";
  const header =
    `handle | title | price (${currency}) | stock | type | tags | images` +
    (withDescriptions ? " | description" : "");

  const lines = products.map((product) => renderProduct(product, withDescriptions, maxDescriptionChars));

  return {
    text: [header, ...lines].join("\n"),
    included: products.length,
    omitted,
    descriptionsIncluded: withDescriptions,
    warnings,
  };
}

function renderProduct(product: IngestedProduct, withDescription: boolean, maxDescriptionChars: number): string {
  const price =
    product.price.min === product.price.max
      ? money(product.price.min)
      : `${money(product.price.min)}–${money(product.price.max)}`;

  const stock = !product.availabilityKnown ? "stock unknown" : product.available ? "in stock" : "sold out";

  const cells = [
    product.handle,
    product.title,
    price,
    stock,
    product.productType ?? "—",
    product.tags.slice(0, 6).join(", ") || "—",
    product.images.length === 0 ? "NO IMAGE" : `${product.images.length} img`,
  ];

  if (withDescription) cells.push(clip(product.description, maxDescriptionChars) || "—");

  const line = cells.join(" | ");

  // Variant ids are only worth their tokens when pinning one changes the
  // price — that is the case `ProductRef.variantId` exists for ("the size
  // that comes in under £60"). For a product with one price, the default
  // variant is always the right answer and the ids are noise.
  if (product.price.min === product.price.max) return line;

  const variants = product.variants
    .slice(0, 12)
    .map((v) => `${v.id} "${v.title}" ${money(v.price)}${v.available ? "" : " sold out"}`)
    .join("; ");
  return `${line}\n    variants: ${variants}`;
}

function money(amount: number): string {
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}

function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
