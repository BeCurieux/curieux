import type { BusinessProfile } from "@/lib/domain/profile";
import type { Product } from "@/lib/domain/product";

// A fictional business for tests. Not a real brand.
export function profile(overrides: Partial<BusinessProfile> = {}): BusinessProfile {
  return {
    id: "profile-1",
    userId: "user-1",
    brandName: "Juniper & Thread",
    websiteUrl: undefined,
    category: "Home and living",
    audience: "New mums who want a calm, practical home. They shop on their phones during naps.",
    productsSummary: "linen aprons and kitchen textiles",
    personality: "warm, witty, calm",
    visualStyle: "earthy and minimal",
    colours: "sage, cream, #632B39",
    market: "Australia",
    currency: "AUD",
    goal: "make 20 sales in the first month",
    stage: "prelaunch",
    fulfilment: "physical",
    verifiedClaims: ["100% European flax linen"],
    prohibitedClaims: ["eco-friendly"],
    logoPath: null,
    brand: null,
    version: 1,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

export function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "product-1",
    userId: "user-1",
    profileId: "profile-1",
    name: "The Everyday Apron",
    category: "Aprons",
    materials: "100% European flax linen, brass buckles",
    dimensions: "",
    colourOptions: "Sage, Oat",
    benefits: "deep pockets, adjustable neck strap",
    intendedUse: "cooking and gardening",
    customerProblem: "your clothes get wrecked while cooking",
    price: 89,
    careInstructions: "",
    shippingInfo: "",
    verifiedClaims: [],
    imageNotes: "Sage apron on a white wall, brass buckle visible",
    imagePaths: [],
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}
