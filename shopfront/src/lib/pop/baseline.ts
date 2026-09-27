/**
 * "That's a collection with a nicer header": the north-star objection, as a
 * number.
 *
 * For every POP, build the collection a competent merchant would have made
 * from the same sentence in five minutes, using Shopify's own tools: a smart
 * collection whose title, tags or product type contain the brief's words
 * (its audience words included: "dads" also searches "men", "mens", "him"),
 * with the same price cap and in-stock filter, in catalogue order, as many
 * products as the POP shows. Then compare.
 *
 * - **High overlap** means the POP picked what keywords would have. On that
 *   catalogue, for that brief, the Genome added a header and nothing else,
 *   and it is better to know that than to pitch it.
 * - **POP-only products** are the case for the product: things that serve
 *   the brief that no keyword would have found. These are what to show a
 *   founder in the kill test.
 *
 * Deliberately a fair collection, not a straw man: it gets the price and
 * stock rules for free, and the audience synonyms a merchant would think of.
 */

import type { Catalogue } from "@/lib/ingest/types";
import type { PopBrief } from "./brief";
import { hardFilter } from "./filter";

const AUDIENCE_WORDS: Record<string, string[]> = {
  men: ["men", "mens", "man", "him", "his", "dad", "dads", "father", "guy", "guys", "gents"],
  women: ["women", "womens", "woman", "her", "mum", "mums", "mom", "moms", "mother", "ladies"],
  kids: ["kid", "kids", "child", "children", "boys", "girls", "junior"],
  baby: ["baby", "babies", "infant", "newborn", "toddler"],
  household: ["home", "house", "household", "family"],
  unisex_adult: ["unisex"],
};

const STOP = new Set([
  "make", "shop", "store", "page", "edit", "under", "below", "over", "with", "for", "who", "the", "and", "our", "that", "this",
  "from", "some", "every", "everything", "their", "them", "day", "days", "love", "loves", "like", "want", "gift", "gifts",
  "less", "than", "more", "most", "best", "only", "just", "all", "any", "into",
]);

/** The words a merchant would type into a smart collection's conditions. */
export function collectionTerms(brief: PopBrief): string[] {
  const terms = new Set<string>();
  for (const w of brief.sentence.toLowerCase().replace(/[''`]s\b/g, "").match(/[a-z]+/g) ?? []) {
    if (w.length >= 3 && !STOP.has(w)) terms.add(w);
  }
  for (const a of brief.who.audienceFit) for (const w of AUDIENCE_WORDS[a] ?? []) terms.add(w);
  return [...terms];
}

export interface Baseline {
  terms: string[];
  /** The keyword collection, same size as the POP. */
  collection: string[];
  /** POP products any of the keywords reach. */
  overlap: string[];
  /** In the POP, found by the Genome, not by any keyword. */
  popOnly: string[];
  /** In the collection, left out by the POP. */
  collectionOnly: string[];
  /** |overlap| / |POP|. 1 means keywords alone reach everything the POP shows. */
  overlapShare: number;
}

export function collectionBaseline(catalogue: Catalogue, brief: PopBrief, popHandles: readonly string[]): Baseline {
  const terms = collectionTerms(brief);
  const matcher = new RegExp(`\\b(?:${terms.map((t) => t.replace(/[^a-z0-9]/g, "")).filter(Boolean).join("|")})\\b`, "i");
  const eligible = hardFilter(catalogue, { ...brief, rules: { ...brief.rules, includeHandles: [] } }).candidates;
  // Everything the keywords match, and the page's worth of it a merchant
  // would actually show (catalogue order). "Found only by the Genome" is
  // judged against the first: a product any keyword reaches is not a find,
  // wherever it would have landed in the collection.
  const matched = terms.length
    ? eligible.filter(({ product }) => matcher.test([product.title, product.productType ?? "", ...product.tags].join(" | "))).map((c) => c.product.handle)
    : [];
  const collection = matched.slice(0, popHandles.length);
  const reachable = new Set(matched);
  const inPop = new Set(popHandles);
  const overlap = popHandles.filter((h) => reachable.has(h));
  return {
    terms,
    collection,
    overlap,
    popOnly: popHandles.filter((h) => !reachable.has(h)),
    collectionOnly: collection.filter((h) => !inPop.has(h)),
    overlapShare: popHandles.length ? overlap.length / popHandles.length : 0,
  };
}

/** One line, for the CLI and the kill-test notes. */
export function describeBaseline(b: Baseline): string {
  const pct = Math.round(b.overlapShare * 100);
  if (b.overlap.length === 0 && b.collection.length === 0) return `A keyword collection finds nothing for "${b.terms.slice(0, 6).join(", ")}"; every product here came from the Genome.`;
  if (pct >= 80) return `${pct}% of this POP is reachable by a keyword collection. On this catalogue, for this brief, it is close to a collection with a nicer header.`;
  return `${b.popOnly.length} of ${b.popOnly.length + b.overlap.length} products here are ones no keyword collection would have found (${pct}% overlap).`;
}
