/**
 * ShopConfig — the single contract between the merchandiser (AI) and the renderer.
 * The AI produces this. The renderer consumes this. Nothing else crosses the boundary.
 *
 * Design intent:
 * - Everything is references + tokens, never markup.
 * - Products are referenced by handle/id from the ingested catalogue; the renderer
 *   resolves them at render time so live data (price, availability) always wins.
 * - Blocks are a small closed set. Adding a block type is a product decision, not
 *   a generation-time improvisation.
 */

import { z } from "zod";

// ---------- Theme ----------

export const ThemeTokens = z.object({
  /** Extracted or inferred from the brand; renderer maps these onto its design system. */
  colorway: z.object({
    background: z.string(),       // css color
    surface: z.string(),
    text: z.string(),
    accent: z.string(),
  }),
  /** Constrained choices — the renderer owns the actual font stacks. */
  typography: z.enum(["editorial-serif", "modern-sans", "soft-rounded", "mono-utility"]),
  /** Overall art direction the renderer interprets. Closed set on purpose. */
  mood: z.enum(["clean", "editorial", "playful", "luxe", "utility"]),
  density: z.enum(["airy", "regular", "compact"]),
  cornerRadius: z.enum(["none", "soft", "round"]),
});

// ---------- Product references ----------

export const ProductRef = z.object({
  /** Handle or id from the ingested catalogue. Renderer resolves live data. */
  handle: z.string(),
  /** Optional AI-written one-liner shown on the card. Max ~90 chars. */
  blurb: z.string().max(120).optional(),
  /** Which catalogue image to lead with (index into the product's images). */
  leadImageIndex: z.number().int().min(0).optional(),
  /** Pin a specific variant (e.g. the $60-and-under size). Omit = default variant. */
  variantId: z.string().optional(),
});

// ---------- Blocks (closed set) ----------

export const HeroBlock = z.object({
  type: z.literal("hero"),
  headline: z.string().max(80),
  subline: z.string().max(140).optional(),
  media: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("productImage"), handle: z.string(), imageIndex: z.number().int().min(0) }),
    z.object({ kind: z.literal("brandAsset"), url: z.string().url() }), // from ingested brand surface only
    z.object({ kind: z.literal("uploaded"), assetId: z.string() }),    // sprint 3+: creator video etc.
  ]).optional(),
  /** Optional CTA scrolls to a block or opens a URL from the link list. */
  cta: z.object({ label: z.string().max(30), targetBlockId: z.string().optional(), url: z.string().url().optional() }).optional(),
});

export const ProductGridBlock = z.object({
  type: z.literal("productGrid"),
  title: z.string().max(60).optional(),
  products: z.array(ProductRef).min(1).max(12),
  layout: z.enum(["grid", "carousel", "stack"]),
});

export const RoutineBlock = z.object({
  /** Ordered, step-labelled products — "shop my routine", gift sets, bundles. */
  type: z.literal("routine"),
  title: z.string().max(60),
  steps: z.array(z.object({ label: z.string().max(40), product: ProductRef })).min(2).max(6),
});

export const DropBlock = z.object({
  type: z.literal("drop"),
  title: z.string().max(60),
  products: z.array(ProductRef).min(1).max(8),
  /** ISO datetime; renderer shows countdown pre-launch, products post-launch. */
  launchesAt: z.string().datetime().optional(),
});

export const ReviewsBlock = z.object({
  type: z.literal("reviews"),
  /** Renderer pulls live aggregate + entries from ingested/synced review data.
   *  The AI only chooses placement and an optional title — never review content. */
  title: z.string().max(60).optional(),
  maxEntries: z.number().int().min(0).max(6),
});

export const OfferBlock = z.object({
  type: z.literal("offer"),
  code: z.string().max(24),
  description: z.string().max(100),
});

export const CaptureBlock = z.object({
  type: z.literal("capture"),
  channel: z.literal("email"), // sms is a paid-tier, sprint-3 addition
  headline: z.string().max(80),
  incentive: z.string().max(80).optional(),
});

export const LinkListBlock = z.object({
  /** The ordinary links, demoted to the bottom where they belong. */
  type: z.literal("linkList"),
  links: z.array(z.object({ label: z.string().max(40), url: z.string().url() })).min(1).max(10),
});

export const Block = z.discriminatedUnion("type", [
  HeroBlock, ProductGridBlock, RoutineBlock, DropBlock, ReviewsBlock, OfferBlock, CaptureBlock, LinkListBlock,
]);

// ---------- Shop ----------

export const ShopConfig = z.object({
  version: z.literal(1),
  brand: z.object({
    name: z.string().max(60),
    tagline: z.string().max(100).optional(),
    logoUrl: z.string().url().optional(),   // from ingested brand surface
    storeUrl: z.string().url(),
  }),
  theme: ThemeTokens,
  /** Ordered blocks, each with a stable id so word-edits can target them. */
  blocks: z.array(z.object({ id: z.string(), block: Block })).min(1).max(10),
  /** Provenance — which prompt produced this config. Kept for merchandising data. */
  meta: z.object({
    prompt: z.string(),
    generatedAt: z.string().datetime(),
    audience: z.string().max(200).optional(), // AI's one-line read of who this shop is for
  }),
});

export type ShopConfig = z.infer<typeof ShopConfig>;

// ---------- Word-editing: the legal moves (sprint 3, defined now) ----------

export const EditMove = z.discriminatedUnion("op", [
  z.object({ op: z.literal("reorderBlocks"), order: z.array(z.string()) }),
  z.object({ op: z.literal("hideBlock"), blockId: z.string() }),
  z.object({ op: z.literal("featureProduct"), handle: z.string() }),          // move to front of its block
  z.object({ op: z.literal("removeProduct"), handle: z.string() }),
  z.object({ op: z.literal("swapLeadImage"), handle: z.string(), imageIndex: z.number().int().min(0) }),
  z.object({ op: z.literal("retone"), mood: ThemeTokens.shape.mood }),
  z.object({ op: z.literal("resizeHero"), size: z.enum(["compact", "regular", "tall"]) }),
  z.object({ op: z.literal("filterInStockOnly"), enabled: z.boolean() }),
  z.object({ op: z.literal("rewriteCopy"), blockId: z.string(), instruction: z.string().max(200) }),
]);

export type EditMove = z.infer<typeof EditMove>;

/**
 * Word-editing contract: user utterance → AI → EditMove[] → validate → apply → re-render.
 * If the utterance maps to nothing in the legal set, respond with what *can* be done.
 * Never free-form mutate the config.
 */
