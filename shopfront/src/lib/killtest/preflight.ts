/**
 * Whether the thing about to be shown to thirty real merchants is real.
 *
 * The brief is specific: "Generate a genuinely excellent shop for each — not a
 * mock, their real products, imagery and reviews." That sentence is a
 * precondition on the whole test, and it is trivially violable by accident —
 * the deterministic providers are the default, they produce a defensible shop,
 * and nothing about the output shouts that the merchandising was assembled by
 * a heuristic rather than judged.
 *
 * A kill-test run that way answers a different question than the one being
 * asked, and answers it in the direction that kills the company: thirty
 * merchants shown a competent-but-flat shop say no, and the conclusion recorded
 * is "merchants do not want this."
 *
 * So this refuses rather than warns.
 */

export interface PreflightInput {
  storeUrls: string[];
  aiProvider?: string | undefined;
  anthropicKey?: string | undefined;
}

export interface Preflight {
  ok: boolean;
  blockers: string[];
  warnings: string[];
}

/** A store URL that is obviously not a real merchant's. */
const NOT_A_MERCHANT = /^(https?:\/\/)?(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|.*\.local)(:\d+)?(\/|$)/i;

export function preflight({ storeUrls, aiProvider, anthropicKey }: PreflightInput): Preflight {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (aiProvider !== "anthropic") {
    blockers.push(
      "AI_PROVIDER is not `anthropic`. The kill test asks thirty merchants what they think of the merchandising, and the deterministic providers do not merchandise — they assemble a defensible default. Running the test on them measures the wrong thing, and measures it in the direction that kills the product.",
    );
  }

  if (!anthropicKey) {
    blockers.push("ANTHROPIC_API_KEY is not set, so no real generation can happen.");
  }

  const fake = storeUrls.filter((url) => NOT_A_MERCHANT.test(url.trim()));
  if (fake.length > 0) {
    blockers.push(
      `${fake.length} target${fake.length === 1 ? " is" : "s are"} a local address (${fake.slice(0, 3).join(", ")}). The test needs real storefronts.`,
    );
  }

  const duplicates = storeUrls.filter((url, index) => storeUrls.indexOf(url) !== index);
  if (duplicates.length > 0) {
    blockers.push(`Duplicate targets: ${[...new Set(duplicates)].slice(0, 3).join(", ")}. Thirty merchants means thirty merchants.`);
  }

  if (storeUrls.length === 0) {
    blockers.push("No targets. Put one storefront URL per line in the targets file.");
  }

  // Warned rather than blocked: a run can legitimately be built up in batches,
  // and the verdict already refuses to call a kill on a short list.
  if (storeUrls.length > 0 && storeUrls.length < 30) {
    warnings.push(
      `${storeUrls.length} targets, and the test is specified at thirty. A short run cannot produce a kill verdict — only a proceed, if five of these clear the bar.`,
    );
  }

  return { ok: blockers.length === 0, blockers, warnings };
}
