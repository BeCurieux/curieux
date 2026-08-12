/**
 * Plan + ingest + prompt + clock -> ShopConfig.
 *
 * The fields the model never sees are filled here, from the only sources that
 * can be trusted for them: the brand's name, logo and URL come from the
 * ingest, the prompt comes from the merchant, and the timestamp comes from the
 * clock. A model asked for any of the three can produce something plausible
 * and wrong, and `brand.logoUrl` pointing at a plausible-but-wrong image is a
 * shop that is subtly not the merchant's.
 *
 * It is also the boundary where ingested truth becomes display contract, and
 * those have different rules. `IngestResult` holds whatever the storefront
 * actually said; `ShopConfig` caps `brand.name` at 60 characters and
 * `brand.tagline` at 100 because they are rendered. Nothing was enforcing the
 * difference, so a store with a long `og:site_name` produced a config that
 * failed its own parse at the last line of generation — after the model call
 * had been paid for, and only ever on a real store.
 */

import { ShopConfig } from "@/lib/schema";
import type { IngestResult } from "@/lib/ingest/types";
import type { MerchandisingPlan } from "./plan";

export interface AssembleInput {
  plan: MerchandisingPlan;
  ingest: IngestResult;
  prompt: string;
  now: Date;
}

export interface Assembled {
  config: ShopConfig;
  /** Anything trimmed on the way in. Never silent — a merchant reads their name. */
  warnings: string[];
}

/** `ShopConfig.brand`'s own limits, restated where they are enforced. */
const NAME_MAX = 60;
const TAGLINE_MAX = 100;

export function assembleShopConfig({ plan, ingest, prompt, now }: AssembleInput): Assembled {
  const { brand } = ingest;
  const warnings: string[] = [];

  // The model's tagline is a merchandising choice for this audience; the
  // ingested one is the brand's own words. Prefer the model's when it wrote
  // one, fall back to theirs, and show nothing rather than invent a third.
  const rawTagline = plan.tagline ?? brand.tagline;

  const name = clamp(brand.name, NAME_MAX, "brand name", warnings);
  const tagline = rawTagline ? clamp(rawTagline, TAGLINE_MAX, "tagline", warnings) : undefined;

  return {
    warnings,
    config: ShopConfig.parse({
      version: 1,
      brand: {
        name,
        ...(tagline ? { tagline } : {}),
        ...(brand.logoUrl ? { logoUrl: brand.logoUrl } : {}),
        storeUrl: brand.storeUrl,
      },
      theme: plan.theme,
      blocks: plan.blocks,
      meta: {
        prompt,
        generatedAt: now.toISOString(),
        audience: plan.audience,
      },
    }),
  };
}

/**
 * Trim to fit, on a word boundary, and say so.
 *
 * Truncating is the right failure here rather than throwing: a name this long
 * is nearly always a templated page title the extractor did not fully strip,
 * and refusing to generate a shop over it costs the merchant more than a
 * shortened name does. But it is their name, so it is never trimmed quietly.
 */
function clamp(value: string, max: number, what: string, warnings: string[]): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;

  const cut = trimmed.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  const shortened = `${(lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;

  warnings.push(
    `The ${what} was ${trimmed.length} characters and the shop shows at most ${max}, so it was shortened to "${shortened}". Check the ingest read it correctly.`,
  );
  return shortened;
}
