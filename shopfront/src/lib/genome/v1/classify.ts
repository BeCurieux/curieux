/**
 * Genome v1 for one catalogue: classify, agree, derive, record.
 *
 *   catalogue
 *     ├─ classifier input per product (inputs.ts), hashed
 *     ├─ unchanged hash + same prompt + same model → reuse the stored values
 *     ├─ everything else × `runs` requests → provider → parse each run
 *     ├─ consensus per dimension, confidence = agreement (consensus.ts)
 *     ├─ deterministic dimensions from price, stock and cost (deterministic.ts)
 *     └─ GenomeValue rows (records.ts), provenance on every one
 *
 * Before anything is sent to a paid provider, the cost is estimated and
 * checked against the M1 cap (cost.ts). After, the measured spend is written
 * to the ledger whether or not every run succeeded, because the tokens were
 * billed either way.
 *
 * Merchant declarations are not produced here. They are separate rows that
 * `resolve()` ranks above these, so re-running the classifier can never
 * silently overwrite something a merchant said.
 */

import type { Catalogue } from "@/lib/ingest/types";
import { parseClassification } from "./classify-schema";
import { consensus, consensusCategory, type RunAnswer } from "./consensus";
import {
  assortmentRole,
  defaultPrice,
  inventoryDepth,
  itemTypeRule,
  marginBand,
  priceBand,
  pricePositions,
  type Derived,
} from "./deterministic";
import { classifierInput, hashOf, inputsHash, type ClassifierInput } from "./inputs";
import { PROMPT_VERSION } from "./prompt";
import { addUsage, ZERO_USAGE, type ClassifierProvider, type ClassifyRequest, type Usage } from "./provider";
import type { GenomeValue } from "./records";
import { dimension, MODEL_DIMENSIONS, PARENT_CATEGORIES, TAXONOMY_VERSION, type DimensionId, type ParentCategory } from "./taxonomy";
import {
  assertWithinCap,
  audPerUsd,
  estimateUsd,
  readLedger,
  recordSpend,
  usdFor,
  type Ledger,
} from "./cost";

export interface ProductRecord {
  storeUrl: string;
  handle: string;
  shopifyId: string | null;
  title: string;
  /** Model-supplied, by consensus; null on a split or before classification. */
  parentCategory: ParentCategory | null;
  /** Hash of the classifier input. A change means reclassify. */
  inputsHash: string;
  /** `<model>@<prompt version>x<runs>` the stored model values came from. */
  classifiedWith: string | null;
}

export interface MerchantFacts {
  /** Handles the merchant features; cold-start heroes. */
  featured?: ReadonlySet<string>;
  /** Minimum stock level. Merchant setting; 5 until the merchant says otherwise. */
  merchantMin?: number;
  /** Admin-only facts, absent on the public path. */
  costPerItem?: ReadonlyMap<string, number>;
  units?: ReadonlyMap<string, number>;
  bundles?: ReadonlySet<string>;
}

export interface ClassifyOptions {
  storeUrl: string;
  catalogue: Catalogue;
  provider: ClassifierProvider;
  runs?: number;
  images?: boolean;
  merchant?: MerchantFacts;
  previous?: { products: readonly ProductRecord[]; values: readonly GenomeValue[] };
  /** Limit how many products are classified (smoke tests, cost probes). */
  limit?: number;
  /** Skip the cap check and the ledger. Tests only. */
  ledger?: { file?: string } | false;
  label?: string;
  now?: Date;
  onProgress?: (message: string) => void;
}

export interface ClassifyResult {
  products: ProductRecord[];
  values: GenomeValue[];
  requests: number;
  failedRuns: { handle: string; run: number; error: string }[];
  reused: number;
  usage: Usage;
  usd: number;
  aud: number;
  /** Measured cost of one product-run, for projections. Null when nothing was billed. */
  usdPerProductRun: number | null;
  ledger: Ledger | null;
}

export const DEFAULT_RUNS = 5;
export const DEFAULT_MERCHANT_MIN = 5;

export async function classifyCatalogue(options: ClassifyOptions): Promise<ClassifyResult> {
  const { storeUrl, provider } = options;
  const runs = options.runs ?? DEFAULT_RUNS;
  const now = (options.now ?? new Date()).toISOString();
  // Runs are part of what a stored value *is*: a 1-run answer has no measured
  // confidence, and must not be reused where five runs were asked for.
  const classifiedWith = `${provider.model}@${PROMPT_VERSION}x${runs}`;
  const products = options.catalogue.products.slice(0, options.limit ?? Infinity);

  const inputs = new Map<string, ClassifierInput>(products.map((p) => [p.handle, classifierInput(p, { images: options.images })]));
  const hashes = new Map([...inputs].map(([handle, input]) => [handle, inputsHash(input)]));

  // Reuse: same inputs, same prompt, same model. Anything else is reclassified.
  const previousProducts = new Map((options.previous?.products ?? []).map((p) => [p.handle, p]));
  const reusable = new Set(
    products
      .map((p) => p.handle)
      .filter((h) => {
        const before = previousProducts.get(h);
        return before && before.inputsHash === hashes.get(h) && before.classifiedWith === classifiedWith;
      }),
  );
  const toClassify = products.filter((p) => !reusable.has(p.handle));

  const requests: ClassifyRequest[] = [];
  toClassify.forEach((p, i) => {
    for (let r = 0; r < runs; r++) requests.push({ customId: `p${i}-r${r}`, input: inputs.get(p.handle)! });
  });

  // ------------------------------------------------ the cap, before spending
  let ledger: Ledger | null = null;
  if (provider.billing !== "free" && options.ledger !== false && requests.length > 0) {
    ledger = await readLedger(options.ledger?.file);
    const perRequest = provider.countInputTokens ? await provider.countInputTokens(requests[0]!) : 3_000;
    const estimate = estimateUsd(provider.model, perRequest, requests.length, provider.billing);
    options.onProgress?.(
      `estimate: ${requests.length} requests × ~${perRequest} input tokens → US$${estimate.toFixed(2)} ≈ A$${(estimate * audPerUsd()).toFixed(2)} (at ${audPerUsd()} AUD/USD)`,
    );
    assertWithinCap(ledger, estimate * audPerUsd());
  }

  const results = requests.length ? await provider.classify(requests, options.onProgress) : [];

  // ------------------------------------------------------- spend, recorded
  const usage = results.reduce((u, r) => addUsage(u, r.usage), ZERO_USAGE);
  const usd = usdFor(provider.model, usage, provider.billing);
  const aud = usd * audPerUsd();
  if (provider.billing !== "free" && options.ledger !== false && requests.length > 0) {
    ledger = await recordSpend(
      { at: now, label: options.label ?? storeUrl, model: provider.model, billing: provider.billing, requests: requests.length, usage, usd, aud },
      options.ledger?.file,
    );
  }

  // ------------------------------------------------------ runs → consensus
  const runsByHandle = new Map<string, { answers: RunAnswer[]; categories: { parent_category?: string }[] }>();
  const failedRuns: ClassifyResult["failedRuns"] = [];
  toClassify.forEach((p) => runsByHandle.set(p.handle, { answers: [], categories: [] }));
  for (const result of results) {
    const [, pi, ri] = /^p(\d+)-r(\d+)$/.exec(result.customId) ?? [];
    const product = toClassify[Number(pi)];
    if (!product) continue;
    const bucket = runsByHandle.get(product.handle)!;
    if (result.error || result.output === null) {
      failedRuns.push({ handle: product.handle, run: Number(ri), error: result.error ?? "no output" });
      continue;
    }
    try {
      const parsed = parseClassification(result.output);
      bucket.answers.push(parsed.answers);
      bucket.categories.push({ parent_category: parsed.parent_category });
    } catch (error) {
      failedRuns.push({ handle: product.handle, run: Number(ri), error: `invalid output: ${error instanceof Error ? error.message.slice(0, 200) : String(error)}` });
    }
  }

  const values: GenomeValue[] = [];
  const productRecords: ProductRecord[] = [];
  const categoryOf = new Map<string, ParentCategory | null>();
  const itemTypeOf = new Map<string, string>();

  for (const p of products) {
    const hash = hashes.get(p.handle)!;
    if (reusable.has(p.handle)) {
      const before = previousProducts.get(p.handle)!;
      categoryOf.set(p.handle, before.parentCategory);
      const kept = (options.previous?.values ?? []).filter(
        (v) => v.handle === p.handle && v.provenance === "taxonomy_model" && v.inputsHash === hash,
      );
      values.push(...kept);
      itemTypeOf.set(p.handle, kept.find((v) => v.dimension === "item_type")?.value ?? "unknown");
      productRecords.push({ ...before, title: p.title, shopifyId: p.id ?? null });
      continue;
    }

    const bucket = runsByHandle.get(p.handle)!;
    const category = consensusCategory(bucket.categories);
    const parentCategory = category && (PARENT_CATEGORIES as readonly string[]).includes(category) ? (category as ParentCategory) : null;
    categoryOf.set(p.handle, parentCategory);
    productRecords.push({ storeUrl, handle: p.handle, shopifyId: p.id ?? null, title: p.title, parentCategory, inputsHash: hash, classifiedWith });

    for (const dim of MODEL_DIMENSIONS) {
      for (const c of consensus(dim, bucket.answers)) {
        values.push(
          row(storeUrl, p.handle, dim, {
            value: c.value,
            provenance: "taxonomy_model",
            confidence: c.confidence,
            rawValue: bucket.answers.length < runs ? `${c.distribution} (${bucket.answers.length} of ${runs} runs valid)` : c.distribution,
            inputsHash: hash,
            runAgreement: c.agreement,
            model: provider.model,
            promptVersion: PROMPT_VERSION,
            derivedAt: now,
          }),
        );
        if (dim === "item_type") itemTypeOf.set(p.handle, c.value);
      }
    }
  }

  // ------------------------------------------------ deterministic dimensions
  const merchant = options.merchant ?? {};
  const currency = options.catalogue.currency;
  const priceOf = new Map(products.map((p) => [p.handle, defaultPrice(p.variants)]));
  const bands = new Map<string, Derived>();
  for (const p of products) bands.set(p.handle, priceBand(priceOf.get(p.handle) ?? null, categoryOf.get(p.handle) ?? null, currency));
  const positions = pricePositions(
    products.map((p) => ({ handle: p.handle, productType: p.productType ?? null, price: priceOf.get(p.handle) ?? null })),
    (handle) => bands.get(handle)?.value ?? "unknown",
  );

  for (const p of products) {
    const price = priceOf.get(p.handle) ?? null;
    const factsHash = (facts: unknown) => hashOf(facts);
    const band = bands.get(p.handle)!;
    const position = positions.get(p.handle)!;
    const depth = inventoryDepth({
      units: merchant.units?.get(p.handle) ?? null,
      available: p.available,
      availabilityKnown: p.availabilityKnown,
      merchantMin: merchant.merchantMin ?? DEFAULT_MERCHANT_MIN,
    });
    const margin = marginBand(price, merchant.costPerItem?.get(p.handle));
    const role = assortmentRole({
      itemType: itemTypeOf.get(p.handle) ?? "unknown",
      pricePosition: position.value,
      featured: merchant.featured?.has(p.handle) ?? false,
    });
    const bundle = itemTypeRule(merchant.bundles?.has(p.handle));

    const derived: [DimensionId, Derived, unknown][] = [
      ["price_band", band, { price, category: categoryOf.get(p.handle), currency }],
      ["price_position", position, { price, n: position.comparisonN, scope: position.comparisonScope }],
      ["inventory_depth", depth, { units: merchant.units?.get(p.handle) ?? null, available: p.available, min: merchant.merchantMin ?? DEFAULT_MERCHANT_MIN }],
      ["margin_band", margin, { price, cost: merchant.costPerItem?.get(p.handle) ?? null }],
      ["assortment_role", role, { item: itemTypeOf.get(p.handle), position: position.value, featured: merchant.featured?.has(p.handle) ?? false }],
      ...(bundle ? ([["item_type", bundle, { bundle: true }]] as [DimensionId, Derived, unknown][]) : []),
    ];
    for (const [dim, d, facts] of derived) {
      values.push(
        row(storeUrl, p.handle, dim, {
          value: d.value,
          provenance: "deterministic_rule",
          confidence: 1,
          evidenceState: d.evidenceState,
          rawValue: d.rawValue,
          comparisonScope: d.comparisonScope,
          comparisonN: d.comparisonN,
          percentile: d.percentile,
          inputsHash: factsHash(facts),
          derivedAt: now,
        }),
      );
    }
  }

  const billedRequests = results.filter((r) => r.usage).length;
  return {
    products: productRecords,
    values,
    requests: requests.length,
    failedRuns,
    reused: reusable.size,
    usage,
    usd,
    aud,
    usdPerProductRun: billedRequests > 0 && usd > 0 ? usd / billedRequests : null,
    ledger,
  };
}

function row(
  storeUrl: string,
  handle: string,
  dim: DimensionId,
  fields: Partial<GenomeValue> & Pick<GenomeValue, "value" | "provenance" | "inputsHash" | "derivedAt">,
): GenomeValue {
  const def = dimension(dim);
  return {
    storeUrl,
    handle,
    dimension: dim,
    layer: def.layer,
    taxonomyVersion: TAXONOMY_VERSION,
    confidence: null,
    evidenceState: null,
    rawValue: null,
    comparisonScope: null,
    comparisonN: null,
    percentile: null,
    runAgreement: null,
    model: null,
    promptVersion: null,
    ...fields,
  };
}
