/**
 * Catalogue + brand context + the merchant's prompt -> ShopConfig.
 *
 * Step 3 of the build order, and the loop the brief demands: every model
 * response is validated against the schema, and an invalid one is retried with
 * the error rather than rendered. Two things are validated, not one — zod
 * proves the shape, `validate.ts` proves the plan is about *this* store — and
 * both feed the same retry.
 *
 * If every attempt fails, this throws. There is no mode where an unvalidated
 * plan reaches the renderer.
 */

import { assembleShopConfig } from "./assemble";
import { createAnthropicProvider } from "./anthropic";
import { MerchandiseError } from "./errors";
import { createMockProvider } from "./mock";
import { MerchandisingPlan } from "./plan";
import { buildBrief, SYSTEM_PROMPT, type BriefOptions } from "./prompt";
import { providerNameFromEnv, type Correction, type MerchandiseProvider } from "./provider";
import { validatePlan } from "./validate";
import type { IngestResult } from "@/lib/ingest/types";
import type { CatalogueGenome } from "@/lib/genome/types";
import type { ShopConfig } from "@/lib/schema";

export interface MerchandiseOptions {
  provider?: MerchandiseProvider;
  /** Total attempts, including the first. */
  maxAttempts?: number;
  /**
   * Step 2's read of this catalogue.
   *
   * Optional, and deliberately so: a store can be merchandised without one, and
   * the diagnostics say when that happened. Making it required would mean a
   * Genome failure took the whole pipeline down, and a shop built without the
   * relationship graph is worse than one built with it — not broken.
   */
  genome?: CatalogueGenome;
  brief?: BriefOptions;
  now?: () => Date;
}

export interface MerchandiseResult {
  config: ShopConfig;
  diagnostics: {
    provider: string;
    model: string;
    attempts: number;
    /** Validation errors from each rejected attempt, oldest first. */
    rejected: string[][];
    warnings: string[];
    usage?: { inputTokens: number; outputTokens: number };
    catalogue: { offered: number; omitted: number; descriptions: boolean; enriched: number };
    /** False when no Genome was supplied — the shop was built without step 2. */
    genome: boolean;
  };
}

/**
 * Three attempts.
 *
 * The first failure is usually a real slip the errors fix. A second failure on
 * the same plan means the brief and the catalogue disagree in a way more
 * retries will not resolve — a store with nothing under the merchant's price
 * cap, say — and the honest answer there is the error, not a fourth attempt at
 * the merchant's expense.
 */
const DEFAULT_MAX_ATTEMPTS = 3;

export async function merchandise(
  ingest: IngestResult,
  prompt: string,
  options: MerchandiseOptions = {},
): Promise<MerchandiseResult> {
  const trimmed = prompt.trim();
  if (!trimmed) {
    throw new MerchandiseError("invalid-plan", "No prompt given. The prompt is the builder — there is nothing to merchandise without one.");
  }
  if (ingest.catalogue.products.length === 0) {
    throw new MerchandiseError("empty-catalogue", `No products were ingested from ${ingest.store.storeUrl}; there is nothing to select from.`);
  }

  const provider = options.provider ?? defaultProvider();
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const now = options.now ?? (() => new Date());

  const brief = buildBrief(ingest, trimmed, withGenome(options));
  const corrections: Correction[] = [];
  const warnings = [...brief.catalogue.warnings];

  let lastModel = provider.name;
  let usage: MerchandiseResult["diagnostics"]["usage"];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await provider.generate({
      ingest,
      prompt: trimmed,
      system: SYSTEM_PROMPT,
      brief: brief.text,
      corrections,
    });
    lastModel = result.model;
    if (result.usage) usage = accumulate(usage, result.usage);

    // Shape first, then meaning. A plan that isn't the right shape has no
    // handles to check, and zod's message is the better one to send back.
    const parsed = MerchandisingPlan.safeParse(result.plan);
    if (!parsed.success) {
      corrections.push({ attempted: result.plan, errors: zodErrors(parsed.error) });
      continue;
    }

    const validation = validatePlan({
      plan: parsed.data,
      ingest,
      prompt: trimmed,
      allowedUrls: brief.allowedUrls,
    });

    if (validation.errors.length > 0) {
      corrections.push({ attempted: result.plan, errors: validation.errors });
      continue;
    }

    return {
      config: assembleShopConfig({ plan: parsed.data, ingest, prompt: trimmed, now: now() }),
      diagnostics: {
        provider: provider.name,
        model: lastModel,
        attempts: attempt,
        rejected: corrections.map((c) => c.errors),
        warnings: [...warnings, ...validation.warnings],
        ...(usage ? { usage } : {}),
        catalogue: {
          offered: brief.catalogue.included,
          omitted: brief.catalogue.omitted,
          descriptions: brief.catalogue.descriptionsIncluded,
          enriched: brief.catalogue.enriched,
        },
        genome: options.genome !== undefined,
      },
    };
  }

  throw new MerchandiseError(
    "invalid-plan",
    `No valid plan after ${maxAttempts} attempts. The last attempt failed on: ${corrections[corrections.length - 1]?.errors.join("; ") ?? "unknown"}`,
    corrections.map((c) => c.errors),
  );
}

/**
 * The Genome reaches the brief through the catalogue view, since that is where
 * it is rendered per product. An explicit `options.genome` wins over one buried
 * in `options.brief.catalogue`, so the common call stays one argument deep.
 */
function withGenome(options: MerchandiseOptions): BriefOptions {
  const brief = options.brief ?? {};
  if (!options.genome) return brief;
  return { ...brief, catalogue: { ...(brief.catalogue ?? {}), genome: options.genome } };
}

function defaultProvider(): MerchandiseProvider {
  return providerNameFromEnv() === "anthropic" ? createAnthropicProvider() : createMockProvider();
}

/** zod's issues, phrased for the model rather than for a stack trace. */
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
  return {
    inputTokens: current.inputTokens + next.inputTokens,
    outputTokens: current.outputTokens + next.outputTokens,
  };
}

export { MerchandiseError } from "./errors";
export { SYSTEM_PROMPT, buildBrief } from "./prompt";
export { MERCHANDISING_PLAN_SCHEMA } from "./plan-schema";
export { MerchandisingPlan, SPRINT_1_BLOCK_TYPES } from "./plan";
export { validatePlan } from "./validate";
export { createMockProvider, buildPlan } from "./mock";
export { createAnthropicProvider } from "./anthropic";
export type { MerchandiseProvider, GenerateRequest, GenerateResult } from "./provider";
