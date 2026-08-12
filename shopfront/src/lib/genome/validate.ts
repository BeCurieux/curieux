/**
 * What the schema cannot catch.
 *
 * Shape is the easy half here too. These are the failures that make a Genome
 * quietly useless rather than obviously broken: a relationship graph pointing at
 * handles that do not exist, a catalogue where every product came back a hero,
 * or a "private" analysis that has a price written into it and is about to hand
 * that price to the merchandiser as if it were context.
 *
 * Errors go back to the model and cost a retry. Warnings do not — they describe
 * a Genome that is usable but worth knowing about.
 */

import { BANNED_CLAIMS, unqualifiedAmounts } from "@/lib/claims";
import type { Catalogue } from "@/lib/ingest/types";
import type { GenomeInference } from "./inference";
import type { ProductInference } from "./types";

export interface GenomeValidationInput {
  inference: GenomeInference;
  catalogue: Catalogue;
  /** The handles actually offered, in order. */
  offered: string[];
}

export interface GenomeValidation {
  errors: string[];
  warnings: string[];
}

/**
 * Above this share of the catalogue marked `hero`, the field has stopped
 * discriminating. It is a warning rather than an error because a genuine
 * six-product catalogue of six strong products exists.
 */
const HERO_SHARE_WARNING = 0.4;

export function validateGenome({ inference, catalogue, offered }: GenomeValidationInput): GenomeValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  const known = new Set(catalogue.products.map((product) => product.handle));
  const offeredSet = new Set(offered);
  const seen = new Set<string>();

  for (const entry of inference.products) {
    if (!known.has(entry.handle)) {
      errors.push(`"${entry.handle}" is not a handle in this catalogue. Use handles exactly as given.`);
      continue;
    }
    if (seen.has(entry.handle)) {
      errors.push(`"${entry.handle}" appears more than once. One entry per product.`);
      continue;
    }
    seen.add(entry.handle);

    checkRelations(entry, known, errors, warnings);
    checkText(entry, errors);
  }

  const missing = offered.filter((handle) => !seen.has(handle));
  if (missing.length > 0) {
    errors.push(
      `Missing entries for ${missing.length} product${missing.length === 1 ? "" : "s"}: ${missing.slice(0, 8).join(", ")}${missing.length > 8 ? ", …" : ""}. Return one entry per product.`,
    );
  }

  const extra = [...seen].filter((handle) => !offeredSet.has(handle));
  if (extra.length > 0) {
    errors.push(`Entries for products that were not in the brief: ${extra.slice(0, 8).join(", ")}.`);
  }

  for (const claim of textOf(inference.catalogueRead)) errors.push(claim);

  const heroes = inference.products.filter((entry) => entry.role === "hero").length;
  if (inference.products.length >= 8 && heroes / inference.products.length > HERO_SHARE_WARNING) {
    warnings.push(
      `${heroes} of ${inference.products.length} products came back as heroes; the role field is not discriminating much for this catalogue.`,
    );
  }

  const isolated = inference.products.filter((e) => e.complements.length === 0 && e.substitutes.length === 0).length;
  if (inference.products.length >= 6 && isolated === inference.products.length) {
    warnings.push("No product relates to any other; routines and bundles will be no better than an arbitrary ordering.");
  }

  const lowConfidence = inference.products.filter((entry) => entry.confidence === "low").length;
  if (lowConfidence > inference.products.length / 2) {
    warnings.push(
      `${lowConfidence} of ${inference.products.length} products were read with low confidence — the catalogue's listings are thin, so merchandising from this Genome is closer to guesswork.`,
    );
  }

  return { errors, warnings };
}

function checkRelations(
  entry: ProductInference,
  known: Set<string>,
  errors: string[],
  warnings: string[],
): void {
  const complements = new Set(entry.complements);
  const substitutes = new Set(entry.substitutes);

  for (const [field, handles] of [
    ["complements", entry.complements],
    ["substitutes", entry.substitutes],
  ] as const) {
    for (const handle of handles) {
      if (handle === entry.handle) {
        errors.push(`"${entry.handle}" lists itself in ${field}.`);
        continue;
      }
      if (!known.has(handle)) {
        errors.push(`"${entry.handle}" lists "${handle}" in ${field}, which is not a handle in this catalogue.`);
      }
    }
  }

  // Used together and chosen between are opposite claims. Both at once means
  // the relationship was not actually decided, and the merchandiser would be
  // reading a coin flip as a fact.
  for (const handle of complements) {
    if (substitutes.has(handle)) {
      errors.push(
        `"${entry.handle}" lists "${handle}" as both a complement and a substitute. A product is used with another or chosen instead of it, not both.`,
      );
    }
  }

  if (entry.complements.length + entry.substitutes.length >= 8) {
    warnings.push(`"${entry.handle}" relates to almost everything, which usually means it relates to nothing in particular.`);
  }
}

/** The Genome is internal, but it feeds a model that writes the page. */
function checkText(entry: ProductInference, errors: string[]): void {
  const fields: [string, string][] = [
    ["problemSolved", entry.problemSolved],
    ["audience", entry.audience],
    ...entry.occasions.map((occasion, index): [string, string] => [`occasions[${index}]`, occasion]),
  ];

  for (const [field, text] of fields) {
    for (const message of textOf(text)) {
      errors.push(`"${entry.handle}" ${field} ${message}`);
    }
  }
}

function textOf(text: string): string[] {
  const problems: string[] = [];
  for (const claim of BANNED_CLAIMS) {
    if (claim.pattern.test(text)) problems.push(`${claim.why}: "${clip(text)}"`);
  }
  const amounts = unqualifiedAmounts(text);
  if (amounts.length > 0) {
    problems.push(
      `names a currency amount (${amounts.join(", ")}). Prices change and this analysis outlives them — describe the product, not its price.`,
    );
  }
  return problems;
}

function clip(text: string): string {
  return text.length <= 90 ? text : `${text.slice(0, 88)}…`;
}
