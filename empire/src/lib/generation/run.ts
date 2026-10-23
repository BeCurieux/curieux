import "server-only";
import { serverEnv } from "@/env";
import { METHODOLOGY } from "@/content/methodology";
import { checkClaims } from "@/lib/ai/guard";
import { estimateCost } from "@/lib/ai/cost";
import { GenerationError } from "@/lib/ai/errors";
import { getAIProvider } from "@/lib/ai/provider";
import { customerData } from "@/lib/ai/prompts";
import { accessFrom, mayGenerate, type Access } from "@/lib/billing/plans";
import { systemRepo } from "@/lib/data";
import type { UserRepo } from "@/lib/data/repo";
import {
  MODULES,
  MODULE_SCHEMAS,
  type AnyModuleOutput,
  type ModuleKey,
} from "@/lib/domain/modules";
import type { BusinessProfile } from "@/lib/domain/profile";
import { missingProductInformation, type Product } from "@/lib/domain/product";
import type { Generation } from "@/lib/domain/records";
import { track } from "@/lib/analytics/track";
import { mergeSection, sectionsOf } from "./sections";

// Running a generator, start to finish. The order matters:
//
//   1. ownership — the profile and product are loaded through the customer's
//      own repo, so another customer's id is simply "not found";
//   2. access — plan, allowance, hourly limit and the platform's daily
//      spending ceiling are all checked before any money is spent;
//   3. generate, with a timeout;
//   4. validate against the module's schema — malformed output is a failure,
//      never shown;
//   5. guard — flag invented or prohibited claims; merge in every missing
//      product fact we can detect ourselves;
//   6. save as the next version, record the cost, count it.
//
// A failure still records what it cost, and is saved as a failed version so
// the customer can see what happened. Failures don't use up her allowance.

export type RunResult =
  | { ok: true; generation: Generation }
  | {
      ok: false;
      reason: "not_found" | "locked" | "allowance" | "hourly" | "platform" | "failed" | "invalid";
      message: string;
    };

export async function loadAccess(
  repo: UserRepo,
): Promise<{ access: Access; used: number; lastHour: number }> {
  const [entitlements, usage] = await Promise.all([
    repo.listEntitlements(),
    repo.listUsage(new Date(0).toISOString()),
  ]);
  const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
  return {
    access: accessFrom(entitlements),
    used: usage.filter((u) => u.operation === "generate").length,
    lastHour: usage.filter((u) => u.createdAt >= hourAgo).length,
  };
}

async function withTimeout<T>(ms: number, work: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      // Settle first, then abort: the provider's own abort error must not win the race.
      reject(
        new GenerationError("That took too long, so we stopped it. Try again.", undefined, true),
      );
      controller.abort();
    }, ms);
  });
  try {
    return await Promise.race([work(controller.signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export interface RunRequest {
  repo: UserRepo;
  profileId: string;
  module: ModuleKey;
  productId?: string | null;
  /** Regenerate one part only, keeping the rest of the current version. */
  section?: string | null;
}

export async function runGeneration(request: RunRequest): Promise<RunResult> {
  const { repo, module } = request;
  const env = serverEnv();
  const info = MODULES[module];

  const profile = await repo.getProfile(request.profileId);
  if (!profile)
    return { ok: false, reason: "not_found", message: "We couldn't find that business." };

  let product: Product | undefined;
  if (info.scope === "product") {
    product = request.productId
      ? ((await repo.getProduct(request.productId)) ?? undefined)
      : undefined;
    if (!product || product.profileId !== profile.id) {
      return { ok: false, reason: "not_found", message: "We couldn't find that product." };
    }
  }

  let base: Generation | undefined;
  if (request.section) {
    base = (
      await repo.listGenerations(profile.id, { module, productId: product?.id ?? null })
    ).find((g) => g.status === "succeeded");
    if (!base?.output || !sectionsOf(module, base.output).includes(request.section)) {
      return { ok: false, reason: "invalid", message: "That section can't be regenerated." };
    }
  }

  const { access, used, lastHour } = await loadAccess(repo);
  const refusal = mayGenerate(access, module, used, lastHour);
  if (refusal) return { ok: false, ...refusal };

  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  if (
    env.EMPIRE_AI_PROVIDER !== "mock" &&
    (await systemRepo().platformCostSince(dayAgo)) >= env.EMPIRE_AI_DAILY_BUDGET_USD
  ) {
    console.error("AI daily budget reached");
    return {
      ok: false,
      reason: "platform",
      message:
        "Empire Studio has paused new generations for a little while. Your work is safe — try again later.",
    };
  }

  const products = await repo.listProducts(profile.id);
  const options = { sampleOnly: module === "theme_prompts" && access.preview };
  const provider = await getAIProvider(env.EMPIRE_AI_PROVIDER);
  const input = { module, profile, product, products, options };
  const inputSnapshot = {
    ...customerData(input),
    options,
    section: request.section ?? null,
    methodology: { status: METHODOLOGY[module].status, version: METHODOLOGY[module].version },
  };

  await track("generation_requested", repo.userId, {
    module,
    section: request.section ?? "all",
    plan: access.plan,
  });

  let usage = { inputTokens: 0, outputTokens: 0 };
  let model = provider.name === "mock" ? "mock-1" : env.EMPIRE_AI_MODEL;
  let output: AnyModuleOutput;
  try {
    const result = await withTimeout(env.EMPIRE_AI_TIMEOUT_MS, (signal) =>
      provider.generate({ ...input, signal }),
    );
    usage = result.usage;
    model = result.model;
    const parsed = MODULE_SCHEMAS[module].safeParse(result.output);
    if (!parsed.success) {
      throw new GenerationError(
        "The result didn't come out in the right shape. Try again.",
        usage,
        true,
      );
    }
    output = finalise(module, parsed.data as AnyModuleOutput, profile, product, options.sampleOnly);
    if (base?.output && request.section) {
      output = MODULE_SCHEMAS[module].parse(
        mergeSection(module, base.output, output, request.section),
      ) as AnyModuleOutput;
    }
  } catch (error) {
    const message =
      error instanceof GenerationError
        ? error.message
        : "Something went wrong while writing this. Try again.";
    if (error instanceof GenerationError) usage = error.usage;
    if (!(error instanceof GenerationError)) console.error("generation failed", module, error);
    const failed = await repo.addGeneration({
      profileId: profile.id,
      productId: product?.id ?? null,
      module,
      status: "failed",
      source: provider.name === "mock" ? "mock" : "ai",
      section: request.section ?? null,
      inputSnapshot,
      output: null,
      warnings: [],
      error: message,
      modelVersion: model,
      profileVersion: profile.version,
    });
    await systemRepo().recordUsage({
      userId: repo.userId,
      generationId: failed.id,
      module,
      operation: "generate_failed",
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      estimatedCost:
        provider.name === "mock" ? 0 : estimateCost(model, usage.inputTokens, usage.outputTokens),
    });
    await track("generation_failed", repo.userId, { module });
    return { ok: false, reason: "failed", message };
  }

  const generation = await repo.addGeneration({
    profileId: profile.id,
    productId: product?.id ?? null,
    module,
    status: "succeeded",
    source: provider.name === "mock" ? "mock" : "ai",
    section: request.section ?? null,
    inputSnapshot,
    output,
    warnings: checkClaims(output, profile, product),
    error: null,
    modelVersion: model,
    profileVersion: profile.version,
  });
  await systemRepo().recordUsage({
    userId: repo.userId,
    generationId: generation.id,
    module,
    operation: "generate",
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    estimatedCost:
      provider.name === "mock" ? 0 : estimateCost(model, usage.inputTokens, usage.outputTokens),
  });

  if (module === "brand_blueprint") {
    await repo.updateProfile(
      profile.id,
      { brand: output as BusinessProfile["brand"] },
      "Brand Blueprint generated",
    );
  }
  await track("generation_succeeded", repo.userId, { module });
  return { ok: true, generation };
}

/** Rules applied to every successful output, whichever provider wrote it. */
function finalise(
  module: ModuleKey,
  output: AnyModuleOutput,
  profile: BusinessProfile,
  product: Product | undefined,
  sampleOnly: boolean,
): AnyModuleOutput {
  if (module === "product_listing" && product) {
    const listing = output as AnyModuleOutput & { missingInformation: string[] };
    const known = new Set(listing.missingInformation.map((m) => m.toLowerCase()));
    const merged = [...listing.missingInformation];
    for (const gap of missingProductInformation(product, profile.fulfilment)) {
      if (!known.has(gap.toLowerCase())) merged.push(gap);
    }
    return { ...listing, missingInformation: merged.slice(0, 15) };
  }
  if (module === "theme_prompts" && sampleOnly) {
    const pack = output as AnyModuleOutput & { prompts: unknown[] };
    return { ...pack, prompts: pack.prompts.slice(0, 1) } as AnyModuleOutput;
  }
  return output;
}

/** Saves the customer's own edit (or a restore) as the next version. */
export async function saveVersion(
  repo: UserRepo,
  baseId: string,
  output: unknown,
  source: "edit" | "restore",
): Promise<
  { ok: true; generation: Generation } | { ok: false; message: string; issues?: string[] }
> {
  const base = await repo.getGeneration(baseId);
  if (!base || base.status !== "succeeded")
    return { ok: false, message: "We couldn't find that version." };
  // Sections hidden in a free preview aren't sent to the browser, so an edit
  // may arrive without them; keep the saved ones rather than failing.
  const merged =
    output && typeof output === "object" && !Array.isArray(output) && base.output
      ? { ...(base.output as Record<string, unknown>), ...(output as Record<string, unknown>) }
      : output;
  const parsed = MODULE_SCHEMAS[base.module].safeParse(merged);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Some fields need fixing before this can be saved.",
      issues: parsed.error.issues
        .slice(0, 8)
        .map((i) => `${i.path.join(" › ") || "field"}: ${i.message}`),
    };
  }
  const profile = await repo.getProfile(base.profileId);
  if (!profile) return { ok: false, message: "We couldn't find that business." };
  const product = base.productId
    ? ((await repo.getProduct(base.productId)) ?? undefined)
    : undefined;
  const value = parsed.data as AnyModuleOutput;
  const generation = await repo.addGeneration({
    profileId: base.profileId,
    productId: base.productId,
    module: base.module,
    status: "succeeded",
    source,
    section: null,
    inputSnapshot: base.inputSnapshot,
    output: value,
    warnings: checkClaims(value, profile, product),
    error: null,
    modelVersion: base.modelVersion,
    profileVersion: base.profileVersion,
  });
  if (base.module === "brand_blueprint") {
    await repo.updateProfile(
      profile.id,
      { brand: value as BusinessProfile["brand"] },
      source === "edit" ? "Brand Blueprint edited" : "Brand Blueprint restored",
    );
  }
  await track("asset_edited", repo.userId, { module: base.module, source });
  return { ok: true, generation };
}
