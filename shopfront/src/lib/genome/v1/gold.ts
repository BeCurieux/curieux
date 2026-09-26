/**
 * The gold set: what the labellers see, how they get in, and what counts as a
 * complete label (HANDOFF §8).
 *
 * ~200 products across ≥8 stores and ≥5 parent categories, labelled
 * independently by two external merchandisers who work from the spec alone.
 * Everything here serves the one number the whole ontology is gated on,
 * inter-labeller kappa, so each choice leans towards keeping that number
 * honest:
 *
 * - **Frozen snapshots.** A labeller sees the product as it was sampled. A
 *   merchant editing a listing mid-labelling cannot make two people answer
 *   about two different things.
 * - **Blind.** A labeller is never shown the model's answer or the other
 *   labeller's. Agreement measured after either would be agreement with a
 *   suggestion.
 * - **Invite links, not accounts.** An external merchandiser gets a URL. The
 *   token in it is shown once and stored only as its sha256, so a leaked
 *   database row is not a working link.
 */

import { createHash, randomBytes } from "node:crypto";
import type { Catalogue, IngestedProduct } from "@/lib/ingest/types";
import { defaultPrice } from "./deterministic";
import type { GoldItem, GoldLabel, GoldSnapshot } from "./store";
import { dimension, isPermitted, MODEL_DIMENSIONS, UNKNOWN, type ModelDimensionId } from "./taxonomy";

// -------------------------------------------------------------- invitation

export function newInviteToken(): string {
  return randomBytes(24).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Tokens are 32 url-safe characters; anything else is not worth a lookup. */
export function plausibleToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{32}$/.test(token);
}

// ---------------------------------------------------------------- snapshot

export function snapshotOf(product: IngestedProduct, currency: string | null): GoldSnapshot {
  const options = new Set<string>();
  for (const v of product.variants) for (const o of v.options) if (o && o !== "Default Title") options.add(o);
  return {
    title: product.title,
    description: product.description,
    productType: product.productType ?? null,
    vendor: product.vendor ?? null,
    tags: product.tags,
    options: [...options],
    images: product.images.slice(0, 4).map((i) => i.url),
    price: defaultPrice(product.variants),
    currency,
    url: product.url,
  };
}

/**
 * A gold item back into the shape the classifier reads, so the model is
 * evaluated on exactly the snapshot the humans labelled, not on whatever the
 * storefront says today.
 */
export function goldCatalogue(items: readonly GoldItem[]): Catalogue {
  return {
    currency: null,
    productCount: items.length,
    truncated: false,
    products: items.map((item) => ({
      handle: item.id,
      id: undefined,
      title: item.snapshot.title,
      description: item.snapshot.description,
      vendor: item.snapshot.vendor ?? undefined,
      productType: item.snapshot.productType ?? undefined,
      tags: item.snapshot.tags,
      url: item.snapshot.url,
      images: item.snapshot.images.map((url) => ({ url })),
      variants: [
        {
          id: "gold",
          title: "Default Title",
          price: item.snapshot.price ?? 0,
          available: true,
          options: item.snapshot.options,
        },
      ],
      price: { min: item.snapshot.price ?? 0, max: item.snapshot.price ?? 0 },
      available: true,
      availabilityKnown: false,
    })),
  };
}

// ----------------------------------------------------------------- sampling

export interface SampleSource {
  storeUrl: string;
  catalogue: Catalogue;
  /** Parent category per handle, when the store has been classified. */
  categories?: ReadonlyMap<string, string | null>;
}

export interface SampleResult {
  items: Omit<GoldItem, "id" | "createdAt">[];
  stores: number;
  categories: string[];
  warnings: string[];
}

export const GOLD_MIN_STORES = 8;
export const GOLD_MIN_CATEGORIES = 5;

/** mulberry32. Seeded, so a gold set can be re-drawn exactly. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Draw a stratified sample: an even share per store, and within each store,
 * round-robin across categories, so no one store or one kind of product
 * dominates the agreement number.
 *
 * The stratum is the parent category when the store has been classified, and
 * the merchant's own product type otherwise. Products with an empty
 * description *and* no image are skipped: nobody can label those, and a gold
 * set full of `unknown` agrees for the wrong reason.
 */
export function sampleGoldSet(sources: readonly SampleSource[], options: { goldSet: string; size?: number; seed?: number }): SampleResult {
  const size = options.size ?? 200;
  const random = rng(options.seed ?? 1);
  const perStore = Math.ceil(size / Math.max(1, sources.length));
  const warnings: string[] = [];
  const chosen: SampleResult["items"] = [];

  for (const source of sources) {
    const buckets = new Map<string, IngestedProduct[]>();
    for (const p of source.catalogue.products) {
      if (!p.description.trim() && p.images.length === 0) continue;
      const key = source.categories?.get(p.handle) ?? p.productType?.trim().toLowerCase() ?? "(untyped)";
      const list = buckets.get(key || "(untyped)");
      if (list) list.push(p);
      else buckets.set(key || "(untyped)", [p]);
    }
    for (const list of buckets.values()) {
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [list[i], list[j]] = [list[j]!, list[i]!];
      }
    }
    const keys = [...buckets.keys()].sort();
    let taken = 0;
    while (taken < perStore && keys.some((k) => buckets.get(k)!.length > 0)) {
      for (const key of keys) {
        const p = buckets.get(key)!.shift();
        if (!p) continue;
        chosen.push({
          goldSet: options.goldSet,
          storeUrl: source.storeUrl,
          handle: p.handle,
          parentCategory: source.categories?.get(p.handle) ?? null,
          snapshot: snapshotOf(p, source.catalogue.currency),
        });
        if (++taken >= perStore) break;
      }
    }
    if (taken < perStore) warnings.push(`${source.storeUrl} gave ${taken} labellable products, short of its ${perStore} share.`);
  }

  const items = chosen.slice(0, size);
  const stores = new Set(items.map((i) => i.storeUrl)).size;
  const categories = [...new Set(items.map((i) => i.parentCategory).filter((c): c is string => Boolean(c)))].sort();
  if (stores < GOLD_MIN_STORES) warnings.push(`Only ${stores} stores; the handoff asks for at least ${GOLD_MIN_STORES}.`);
  if (categories.length > 0 && categories.length < GOLD_MIN_CATEGORIES) {
    warnings.push(`Only ${categories.length} parent categories; the handoff asks for at least ${GOLD_MIN_CATEGORIES}.`);
  }
  if (categories.length === 0) warnings.push("Stores were not classified, so category coverage is by product type and unverified.");
  return { items, stores, categories, warnings };
}

// ------------------------------------------------------------------ labels

export class LabelError extends Error {}

/** Check one submitted answer against the taxonomy; return it normalised. */
export function validateLabel(dim: string, raw: readonly string[]): { dimension: ModelDimensionId; labels: string[] } {
  if (!(MODEL_DIMENSIONS as readonly string[]).includes(dim)) throw new LabelError(`Not a labelled dimension: ${dim}`);
  const d = dimension(dim as ModelDimensionId);
  const labels = [...new Set(raw.map((x) => x.trim()).filter(Boolean))];
  if (labels.length === 0) throw new LabelError(`${d.label}: choose an answer, or "${UNKNOWN}".`);
  const illegal = labels.filter((x) => !isPermitted(d.id as ModelDimensionId, x));
  if (illegal.length) throw new LabelError(`${d.label}: ${illegal.join(", ")} is not an option.`);
  if (d.cardinality === "single" && labels.length > 1) throw new LabelError(`${d.label}: choose one.`);
  if (d.maxLabels && labels.length > d.maxLabels) throw new LabelError(`${d.label}: choose at most ${d.maxLabels}.`);
  if (labels.length > 1 && labels.includes(UNKNOWN)) throw new LabelError(`${d.label}: "${UNKNOWN}" cannot sit beside another answer.`);
  return { dimension: d.id as ModelDimensionId, labels };
}

/** Items this labeller has answered every dimension of. */
export function completedItems(labels: readonly GoldLabel[], labellerId: string, taxonomyVersion: string): Set<string> {
  const byItem = new Map<string, Set<string>>();
  for (const l of labels) {
    if (l.labellerId !== labellerId || l.taxonomyVersion !== taxonomyVersion) continue;
    const dims = byItem.get(l.itemId) ?? new Set<string>();
    dims.add(l.dimension);
    byItem.set(l.itemId, dims);
  }
  return new Set([...byItem].filter(([, dims]) => MODEL_DIMENSIONS.every((d) => dims.has(d))).map(([id]) => id));
}

/** The first item in gold-set order this labeller has not finished. */
export function nextItem(items: readonly GoldItem[], done: ReadonlySet<string>): GoldItem | null {
  return items.find((i) => !done.has(i.id)) ?? null;
}
