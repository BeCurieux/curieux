/**
 * Catalogue in, Catalogue Genome out.
 *
 * Step 2 of the build order: an enrichment pass that turns a list of products
 * into a read of what each one is for and how they relate. The merchandiser at
 * step 3 consumes it, and it is the difference between merchandising decisions
 * that are good and ones that are merely plausible.
 *
 * The same retry discipline as the merchandiser — zod for shape, then semantics
 * against this catalogue, and an invalid read goes back to the model with its
 * errors rather than being stored. A Genome is an input to every shop the store
 * ever generates, so a bad one is not a bad page; it is a bad page every time.
 *
 * Two fields never reach the model at all. Price tier and photography quality
 * are computed in `heuristics.ts` and merged in here, because they are questions
 * about a distribution and a set of dimensions rather than about language.
 */

import { createAnthropicGenomeProvider } from "./anthropic";
import { GenomeError } from "./errors";
import { computePriceBands, priceTierFor, readPhotography } from "./heuristics";
import { GenomeInference } from "./inference";
import { createMockGenomeProvider } from "./mock";
import { buildGenomeBrief, SYSTEM_PROMPT, type GenomeBriefOptions } from "./prompt";
import { providerNameFromEnv, type GenomeCorrection, type GenomeProvider } from "./provider";
import { validateGenome } from "./validate";
import type { IngestResult } from "@/lib/ingest/types";
import type { CatalogueGenome, ProductGenome } from "./types";

export interface EnrichOptions {
  provider?: GenomeProvider;
  maxAttempts?: number;
  brief?: GenomeBriefOptions;
  now?: () => Date;
}

/** Same reasoning as the merchandiser's: a third try does not fix a disagreement. */
const DEFAULT_MAX_ATTEMPTS = 3;

export async function enrichCatalogue(ingest: IngestResult, options: EnrichOptions = {}): Promise<CatalogueGenome> {
  const { catalogue, brand, store } = ingest;

  if (catalogue.products.length === 0) {
    throw new GenomeError("empty-catalogue", `No products were ingested from ${store.storeUrl}; there is nothing to enrich.`);
  }

  const brief = buildGenomeBrief(catalogue, brand, options.brief ?? {});
  const provider = options.provider ?? defaultProvider(brief.products);
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const now = options.now ?? (() => new Date());

  const handles = brief.products.map((product) => product.handle);
  const corrections: GenomeCorrection[] = [];
  const warnings = [...brief.warnings];

  let lastModel = provider.name;
  let usage: CatalogueGenome["diagnostics"]["usage"];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await provider.read({ system: SYSTEM_PROMPT, brief: brief.text, handles, corrections });
    lastModel = result.model;
    if (result.usage) usage = accumulate(usage, result.usage);

    const parsed = GenomeInference.safeParse(result.inference);
    if (!parsed.success) {
      corrections.push({ attempted: result.inference, errors: zodErrors(parsed.error) });
      continue;
    }

    const validation = validateGenome({ inference: parsed.data, catalogue, offered: handles });
    if (validation.errors.length > 0) {
      corrections.push({ attempted: result.inference, errors: validation.errors });
      continue;
    }

    const bands = computePriceBands(catalogue);
    const byHandle = new Map(catalogue.products.map((product) => [product.handle, product]));

    const products: ProductGenome[] = parsed.data.products.map((inference) => {
      // Every handle was proved present by the validator above.
      const product = byHandle.get(inference.handle)!;
      return {
        ...inference,
        priceTier: priceTierFor(product, bands),
        photography: readPhotography(product),
      };
    });

    return {
      version: 1,
      storeUrl: store.storeUrl,
      generatedAt: now().toISOString(),
      catalogueRead: parsed.data.catalogueRead,
      products,
      priceBands: bands,
      diagnostics: {
        provider: provider.name,
        model: lastModel,
        attempts: attempt,
        rejected: corrections.map((c) => c.errors),
        warnings: [...warnings, ...validation.warnings],
        ...(usage ? { usage } : {}),
        enriched: products.length,
        catalogueSize: catalogue.products.length,
      },
    };
  }

  throw new GenomeError(
    "invalid-genome",
    `No valid catalogue read after ${maxAttempts} attempts. The last attempt failed on: ${corrections[corrections.length - 1]?.errors.slice(0, 3).join("; ") ?? "unknown"}`,
    corrections.map((c) => c.errors),
  );
}

/** Look up one product's Genome. Absent is a normal answer, not an error. */
export function genomeFor(genome: CatalogueGenome | undefined, handle: string): ProductGenome | undefined {
  return genome?.products.find((entry) => entry.handle === handle);
}

function defaultProvider(products: Parameters<typeof createMockGenomeProvider>[0]): GenomeProvider {
  return providerNameFromEnv() === "anthropic" ? createAnthropicGenomeProvider() : createMockGenomeProvider(products);
}

function zodErrors(error: { issues: { path: (string | number)[]; message: string }[] }): string[] {
  return error.issues.slice(0, 20).map((issue) => {
    const path = issue.path.length ? issue.path.join(".") : "(root)";
    return `${path}: ${issue.message}`;
  });
}

function accumulate(
  current: { inputTokens: number; outputTokens: number } | undefined,
  next: { inputTokens: number; outputTokens: number },
): { inputTokens: number; outputTokens: number } {
  if (!current) return next;
  return { inputTokens: current.inputTokens + next.inputTokens, outputTokens: current.outputTokens + next.outputTokens };
}

export { GenomeError } from "./errors";
export { SYSTEM_PROMPT, buildGenomeBrief } from "./prompt";
export { GENOME_INFERENCE_SCHEMA } from "./inference-schema";
export { GenomeInference } from "./inference";
export { validateGenome } from "./validate";
export { computePriceBands, priceTierFor, readPhotography } from "./heuristics";
export { createMockGenomeProvider, readCatalogue } from "./mock";
export { createAnthropicGenomeProvider } from "./anthropic";
export type { GenomeProvider, GenomeRequest, GenomeResult } from "./provider";
export type * from "./types";
