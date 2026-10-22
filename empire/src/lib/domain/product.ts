import { z } from "zod";
import { claimList } from "./profile";

// One product the owner sells. Everything here is something she has told us,
// so the Product Writer and Mockup Studio may state it. Anything a good
// listing needs that is missing here gets flagged, never invented — see
// missingProductInformation() below and src/lib/ai/guard.ts.

const text = (max: number) => z.string().trim().max(max);

export const productInputSchema = z.object({
  name: text(120).min(1, "Required"),
  category: text(80).default(""),
  materials: text(800).default(""),
  dimensions: text(300).default(""),
  colourOptions: text(300).default(""),
  benefits: text(1000).default(""),
  intendedUse: text(600).default(""),
  customerProblem: text(600).default(""),
  price: z
    .union([z.literal(""), z.coerce.number().min(0).max(1_000_000)])
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .default(null),
  careInstructions: text(600).default(""),
  shippingInfo: text(600).default(""),
  verifiedClaims: claimList.default([]),
  // What is actually in the uploaded photos, in the owner's words. The briefs
  // describe these; they never guess from pixels.
  imageNotes: text(800).default(""),
});

export type ProductInput = z.infer<typeof productInputSchema>;

export interface Product extends ProductInput {
  id: string;
  userId: string;
  profileId: string;
  imagePaths: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Facts a complete listing normally needs, and which of them are blank.
 *
 * Deterministic and model-independent: the AI is also asked to flag gaps,
 * but this list is merged in regardless so a gap can never be papered over.
 */
export function missingProductInformation(
  product: ProductInput,
  fulfilment: "physical" | "digital" | "both",
): string[] {
  const missing: string[] = [];
  const physical = fulfilment !== "digital";
  if (!product.materials) {
    missing.push(
      physical
        ? "Materials or ingredients — the listing doesn't say what it's made of."
        : "What's included — file types, page count or format.",
    );
  }
  if (physical && !product.dimensions) missing.push("Size or dimensions.");
  if (!product.benefits) missing.push("What it does for the customer (functional benefits).");
  if (!product.customerProblem) missing.push("The problem it solves for your customer.");
  if (product.price === null) missing.push("Price.");
  if (physical && !product.careInstructions && /cloth|fabric|linen|cotton|wool|silk|leather|wood|ceramic|candle|jewel|silver|gold|brass/i.test(`${product.materials} ${product.category} ${product.name}`)) {
    missing.push("Care instructions.");
  }
  if (physical && !product.shippingInfo) {
    missing.push("Shipping times and costs — leave delivery promises out until you know them.");
  }
  if (!physical && !product.shippingInfo) {
    missing.push("How the customer receives it (instant download, emailed link, etc.).");
  }
  return missing;
}

export function productForPrompt(product: Product) {
  return {
    name: product.name,
    category: product.category,
    materials: product.materials,
    dimensions: product.dimensions,
    colourOptions: product.colourOptions,
    benefits: product.benefits,
    intendedUse: product.intendedUse,
    customerProblem: product.customerProblem,
    price: product.price,
    careInstructions: product.careInstructions,
    shippingInfo: product.shippingInfo,
    verifiedClaims: product.verifiedClaims,
    imageNotes: product.imageNotes,
    photoCount: product.imagePaths.length,
  };
}
