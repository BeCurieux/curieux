/**
 * The Catalogue Genome — what we know about a merchant's products beyond what
 * the storefront literally said.
 *
 * Step 2 of the build order. The ingester answers "what is in this catalogue";
 * this answers "what is each of these things *for*, and how do they relate" —
 * which is the difference between the merchandiser making good decisions and
 * plausible ones. A model asked to build a three-step routine from titles and
 * prices alone is guessing at order; one that has been told which product is a
 * hero, which is an add-on, and what complements what, is not.
 *
 * Two disciplines run through the shapes below.
 *
 * **Every field is an inference and is marked as one.** Nothing here is a fact
 * the storefront asserted. CLAUDE.md is explicit that Genome fields stay
 * internal and are never rendered as claims, so nothing in this file is
 * reachable from `ShopConfig` — the Genome feeds the merchandiser's *judgement*
 * and never its *copy*.
 *
 * **The model is only asked what a model can know.** Price tier and photography
 * quality are computed from the catalogue itself, because they are questions
 * about a distribution and a set of pixel dimensions rather than about
 * language. Asking a model for them produces confident nonsense: every £200
 * item reads as "premium" until you notice the store's cheapest product is £180.
 */

/** Where this product sits in *this store's* price distribution — computed. */
export type PriceTier = "entry" | "core" | "premium" | "flagship";

/**
 * What a product is for on a page, rather than in a catalogue.
 *
 * `hero` can carry a shop on its own; `supporting` is worth a card next to
 * something else; `add-on` is what a shopper adds once they have decided.
 */
export type ProductRole = "hero" | "supporting" | "add-on";

export type Giftability = "high" | "medium" | "low";

/** How much the listing actually gave the model to work with. */
export type Confidence = "high" | "medium" | "low";

export type PhotographyRating = "strong" | "adequate" | "weak" | "none";

/**
 * How well this product's imagery will survive the renderer — computed.
 *
 * Not an aesthetic judgement: we never see the pixels. This is about whether
 * there are enough images, at enough resolution, in a shape that survives being
 * cropped to a single plate ratio. `dimensionsKnown` is load-bearing in the same
 * way `availabilityKnown` is on the catalogue — some ingest surfaces return bare
 * image URLs with no size, and "we did not measure" must never be recorded as
 * "measured and found wanting".
 */
export interface PhotographyRead {
  rating: PhotographyRating;
  imageCount: number;
  /** False when the ingest surface gave URLs without dimensions. */
  dimensionsKnown: boolean;
  /** Plain reasons, for the merchandiser's brief and for a human debugging one. */
  notes: string[];
}

/** The fields a model supplies. Merged with the computed ones below. */
export interface ProductInference {
  handle: string;
  /** What this product does for the person who buys it, in one clause. */
  problemSolved: string;
  /** Who reaches for it — a description of a person, not a demographic bucket. */
  audience: string;
  /** When it gets bought. Zero to three short phrases. */
  occasions: string[];
  role: ProductRole;
  giftability: Giftability;
  /** Handles bought or used alongside this one. */
  complements: string[];
  /** Handles a shopper would choose between, not with. */
  substitutes: string[];
  confidence: Confidence;
}

export interface ProductGenome extends ProductInference {
  priceTier: PriceTier;
  photography: PhotographyRead;
}

export interface CatalogueGenome {
  version: 1;
  storeUrl: string;
  /** ISO. The Genome ages with the catalogue it was read from. */
  generatedAt: string;
  /** One sentence on what this store actually sells. Model-supplied. */
  catalogueRead: string;
  products: ProductGenome[];
  /** The computed tier boundaries, so a tier is auditable rather than asserted. */
  priceBands: PriceBands;
  diagnostics: GenomeDiagnostics;
}

export interface PriceBands {
  /** Upper bound of each tier, in the catalogue's currency. Null when uncomputable. */
  entryBelow: number | null;
  coreBelow: number | null;
  premiumBelow: number | null;
  /** How many products the bands were computed from. */
  sampled: number;
}

export interface GenomeDiagnostics {
  provider: string;
  model: string;
  attempts: number;
  rejected: string[][];
  warnings: string[];
  usage?: { inputTokens: number; outputTokens: number };
  /** Products offered to the model vs products in the catalogue. */
  enriched: number;
  catalogueSize: number;
}
