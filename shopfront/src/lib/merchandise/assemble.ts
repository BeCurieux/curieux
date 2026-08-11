/**
 * Plan + ingest + prompt + clock -> ShopConfig.
 *
 * The fields the model never sees are filled here, from the only sources that
 * can be trusted for them: the brand's name, logo and URL come from the
 * ingest, the prompt comes from the merchant, and the timestamp comes from the
 * clock. A model asked for any of the three can produce something plausible
 * and wrong, and `brand.logoUrl` pointing at a plausible-but-wrong image is a
 * shop that is subtly not the merchant's.
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

export function assembleShopConfig({ plan, ingest, prompt, now }: AssembleInput): ShopConfig {
  const { brand } = ingest;
  // The model's tagline is a merchandising choice for this audience; the
  // ingested one is the brand's own words. Prefer the model's when it wrote
  // one, fall back to theirs, and show nothing rather than invent a third.
  const tagline = plan.tagline ?? brand.tagline;

  return ShopConfig.parse({
    version: 1,
    brand: {
      name: brand.name,
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
  });
}
