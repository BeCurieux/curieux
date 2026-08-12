/**
 * What the ingester produces.
 *
 * This is the *other* contract in the system. `schema.ts` is what the AI
 * writes; this is what the AI reads. Between them there is one rule that
 * matters more than any other in the brief:
 *
 *   > Prices, availability and imagery come from ingested data only. Never
 *   > invent products, prices, reviews or review counts.
 *
 * So every field here is either something a storefront actually told us, or
 * an explicit admission that it didn't. There is no "sensible default" for a
 * price. Where a fact is missing the type says `undefined` or the sibling
 * `*Known` flag says false, and the renderer is expected to show nothing
 * rather than something plausible.
 */

import { z } from "zod";

// ---------- Products ----------

export const IngestedImage = z.object({
  url: z.string().url(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  /** Storefronts almost never set this. When they do it is worth having. */
  alt: z.string().optional(),
});
export type IngestedImage = z.infer<typeof IngestedImage>;

export const IngestedVariant = z.object({
  /** Stringified: Shopify variant ids are 64-bit and JSON numbers are not. */
  id: z.string(),
  title: z.string(),
  sku: z.string().optional(),
  /** Decimal in the shop's currency. 24.5 means 24.50, never 2450. */
  price: z.number().nonnegative(),
  compareAtPrice: z.number().nonnegative().optional(),
  available: z.boolean(),
  /** e.g. ["Small", "Sage"] — the option values, in the shop's own order. */
  options: z.array(z.string()),
  imageUrl: z.string().url().optional(),
});
export type IngestedVariant = z.infer<typeof IngestedVariant>;

export const IngestedProduct = z.object({
  /** The catalogue key. `ProductRef.handle` in schema.ts points at this. */
  handle: z.string().min(1),
  id: z.string().optional(),
  title: z.string().min(1),
  /** Plain text, tags stripped, capped. The merchandiser reads this. */
  description: z.string(),
  vendor: z.string().optional(),
  productType: z.string().optional(),
  tags: z.array(z.string()),
  /** Absolute. Becomes the product link and the basis of the cart permalink. */
  url: z.string().url(),
  images: z.array(IngestedImage),
  variants: z.array(IngestedVariant).min(1),
  price: z.object({ min: z.number().nonnegative(), max: z.number().nonnegative() }),
  /**
   * True if any variant can be bought.
   *
   * Sold-out products are ingested and kept — the brief is explicit that they
   * are shown and marked, never hidden. Filtering happens (if at all) in the
   * merchandiser, from a complete catalogue, not by quietly dropping rows here.
   */
  available: z.boolean(),
  /**
   * Whether `available` is a fact or a fallback.
   *
   * A few storefront surfaces omit availability entirely. When that happens we
   * assume in-stock, because the two errors are not symmetrical: a false
   * "sold out" badge kills a sale outright, while a missing one costs a
   * shopper one disappointed tap at the cart. But we record that we guessed,
   * so the renderer can suppress the stock state rather than assert it.
   */
  availabilityKnown: z.boolean(),
  publishedAt: z.string().optional(),
  createdAt: z.string().optional(),
});
export type IngestedProduct = z.infer<typeof IngestedProduct>;

export const Catalogue = z.object({
  /** ISO 4217, when the storefront told us. Never assumed to be USD. */
  currency: z.string().nullable(),
  products: z.array(IngestedProduct),
  /** How many the store has, if that differs from how many we took. */
  productCount: z.number().int().nonnegative(),
  truncated: z.boolean(),
});
export type Catalogue = z.infer<typeof Catalogue>;

// ---------- Brand ----------

/**
 * A colour we found, and how often. Ranked, not chosen — the merchandiser
 * decides the theme; this is the evidence it decides from.
 */
export const ColourCandidate = z.object({
  hex: z.string(),
  /** Occurrences across the homepage's style surfaces. */
  weight: z.number().int().positive(),
  /** 0-1. Used to tell a brand colour from another shade of grey. */
  saturation: z.number().min(0).max(1),
  /** 0-1 relative luminance, for contrast decisions. */
  luminance: z.number().min(0).max(1),
  /**
   * The CSS custom-property names it was declared under, e.g. "color-accent".
   * The theme telling us what a colour is *for* beats any amount of counting.
   */
  roles: z.array(z.string()),
});
export type ColourCandidate = z.infer<typeof ColourCandidate>;

/**
 * Evidence of how a brand writes, not a judgement about it.
 *
 * The ingester deliberately does not decide that a shop is "playful" or
 * "luxe" — that is a model call, and it happens in step 2 with the prompt in
 * hand. Here we collect the shop's own words so that call has something real
 * to read instead of a guess.
 */
export const VoiceEvidence = z.object({
  headings: z.array(z.string()),
  sentences: z.array(z.string()),
  navLabels: z.array(z.string()),
  buttonLabels: z.array(z.string()),
});
export type VoiceEvidence = z.infer<typeof VoiceEvidence>;

export const BrandContext = z.object({
  name: z.string(),
  storeUrl: z.string().url(),
  /** Short line from og:description / meta description, if there is one. */
  tagline: z.string().optional(),
  description: z.string().optional(),
  logoUrl: z.string().url().optional(),
  /** og:image. Not a logo — a share card. Useful as hero art, labelled as such. */
  socialImageUrl: z.string().url().optional(),
  palette: z.array(ColourCandidate),
  /**
   * A first cut at `ThemeTokens.colorway`, contrast-checked. The merchandiser
   * may override it; it exists so that when the model has nothing to say
   * about colour, the fallback is still the brand's own.
   */
  suggestedColorway: z.object({
    background: z.string(),
    surface: z.string(),
    text: z.string(),
    accent: z.string(),
  }),
  themeColor: z.string().optional(),
  locale: z.string().optional(),
  voice: VoiceEvidence,
  /** Same-site nav worth demoting into a LinkListBlock later. */
  links: z.array(z.object({ label: z.string(), url: z.string().url() })),
  socialLinks: z.array(z.object({ platform: z.string(), url: z.string().url() })),
});
export type BrandContext = z.infer<typeof BrandContext>;

// ---------- Reviews ----------

/**
 * Reviews are a first-class part of the pitch and are *not* ingestable from a
 * public storefront in this step, so this type exists to say so out loud.
 *
 * "If reviews aren't ingestable for a store, omit the reviews block entirely."
 * A `ReviewsBlock` in a ShopConfig built from an ingest where `available` is
 * false is a bug, not a stylistic choice — the page would be claiming social
 * proof we never read.
 */
export const ReviewAvailability = z.object({
  available: z.literal(false),
  /** e.g. "judge.me" — detected from the homepage, so we know what to build. */
  platformDetected: z.string().nullable(),
  note: z.string(),
});
export type ReviewAvailability = z.infer<typeof ReviewAvailability>;

// ---------- Result ----------

/** Which rung of the ladder actually produced the catalogue. */
export const CatalogueSource = z.enum([
  "products.json",
  "collections-all.json",
  "sitemap+product.js",
  "rendered",
]);
export type CatalogueSource = z.infer<typeof CatalogueSource>;

export const TraceEntry = z.object({
  step: z.string(),
  url: z.string().optional(),
  outcome: z.enum(["ok", "empty", "skipped", "failed"]),
  detail: z.string().optional(),
  ms: z.number().int().nonnegative().optional(),
});
export type TraceEntry = z.infer<typeof TraceEntry>;

export const IngestResult = z.object({
  store: z.object({
    inputUrl: z.string(),
    /** Canonical origin after redirects. www vs apex resolved here, once. */
    storeUrl: z.string().url(),
    platform: z.enum(["shopify", "unknown"]),
    catalogueSource: CatalogueSource,
    ingestedAt: z.string(),
  }),
  brand: BrandContext,
  catalogue: Catalogue,
  reviews: ReviewAvailability,
  diagnostics: z.object({
    warnings: z.array(z.string()),
    trace: z.array(TraceEntry),
  }),
});
export type IngestResult = z.infer<typeof IngestResult>;

// ---------- Failure ----------

export type IngestFailureCode =
  | "bad-url"
  | "unreachable"
  | "no-catalogue"
  | "robots-denied";

/**
 * Ingest fails loudly or not at all. There is no partial mode where we return
 * an empty catalogue and let the merchandiser improvise — improvising is
 * exactly what produces a shop full of products the merchant does not sell.
 */
export class IngestError extends Error {
  constructor(
    readonly code: IngestFailureCode,
    message: string,
    readonly trace: TraceEntry[] = [],
  ) {
    super(message);
    this.name = "IngestError";
  }
}
