/**
 * What the model is actually allowed to produce.
 *
 * The brief says the AI fills a schema and never writes markup. This is that
 * schema — but deliberately *narrower* than `ShopConfig`, for one reason: a
 * model asked for `brand.storeUrl` or `brand.logoUrl` can get them wrong, and
 * a shop whose logo points at a URL nobody ingested is exactly the invented
 * data the brief forbids. So the model produces the parts that are genuinely
 * merchandising decisions — selection, order, grouping, copy, theme — and the
 * code assembles the rest from the ingest, the prompt and the clock.
 *
 * Everything here is built from `schema.ts`, so the two cannot drift.
 */

import { z } from "zod";
import {
  DropBlock,
  HeroBlock,
  LinkListBlock,
  OfferBlock,
  ProductGridBlock,
  RoutineBlock,
  ThemeTokens,
} from "@/lib/schema";

/**
 * The blocks available in this sprint, and why the other two are not.
 *
 * `reviews` — review data is not ingestable from a public storefront (see
 * `ingest/types.ts`), so a reviews block would be claiming social proof
 * nobody read.
 *
 * `capture` — email capture is Sprint 3 in the build order. Nothing is wired
 * to collect an address, and a form that posts into nothing is the exact
 * dishonesty the brief rules out.
 *
 * Both are one line away from being available once the thing behind them is.
 */
export const SPRINT_1_BLOCK_TYPES = [
  "hero",
  "productGrid",
  "routine",
  "drop",
  "offer",
  "linkList",
] as const;

export type Sprint1BlockType = (typeof SPRINT_1_BLOCK_TYPES)[number];

export const PlannedBlock = z.discriminatedUnion("type", [
  HeroBlock,
  ProductGridBlock,
  RoutineBlock,
  DropBlock,
  OfferBlock,
  LinkListBlock,
]);
export type PlannedBlock = z.infer<typeof PlannedBlock>;

export const MerchandisingPlan = z.object({
  /** One line on who this shop is for. Becomes `ShopConfig.meta.audience`. */
  audience: z.string().max(200),
  /**
   * An optional line under the brand name. The ingested tagline is used when
   * the model doesn't write one — the merchant's own words beat ours.
   */
  tagline: z.string().max(100).optional(),
  theme: ThemeTokens,
  blocks: z.array(z.object({ id: z.string().min(1), block: PlannedBlock })).min(1).max(10),
});
export type MerchandisingPlan = z.infer<typeof MerchandisingPlan>;
