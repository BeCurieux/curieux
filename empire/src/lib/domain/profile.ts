import { z } from "zod";

// The business profile: what the customer tells us once, and the Brand
// Blueprint every later generator reads. docs/DATA_MODEL.md has the tables.
//
// Facts and claims are kept apart on purpose. `verifiedClaims` are things the
// owner has told us are true and can stand behind (e.g. "handmade in
// Melbourne", "100% cotton"). Generators may repeat them and nothing else of
// the kind. `prohibitedClaims` are things she never wants said.

const text = (max: number) => z.string().trim().max(max);
const required = (max: number) => text(max).min(1, "Required");

export const STAGES = ["idea", "prelaunch", "launched", "growing"] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<Stage, string> = {
  idea: "Just an idea",
  prelaunch: "Getting ready to launch",
  launched: "Launched, finding my feet",
  growing: "Selling and growing",
};

export const FULFILMENT = ["physical", "digital", "both"] as const;
export type Fulfilment = (typeof FULFILMENT)[number];

export const FULFILMENT_LABELS: Record<Fulfilment, string> = {
  physical: "Physical products I ship",
  digital: "Digital products or downloads",
  both: "A mix of both",
};

export const CATEGORIES = [
  "Fashion and accessories",
  "Jewellery",
  "Beauty and skincare",
  "Home and living",
  "Stationery and paper goods",
  "Printables and digital downloads",
  "Kids and baby",
  "Food and drink",
  "Health and wellness",
  "Pets",
  "Art and prints",
  "Other",
] as const;

/** A short list of claims split from a textarea, one per line. */
export const claimList = z
  .array(text(200))
  .max(30)
  .transform((items) => items.map((item) => item.trim()).filter(Boolean));

export function linesToList(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Onboarding: the minimum to start. Everything else can come later. */
export const profileFactsSchema = z.object({
  brandName: required(80),
  websiteUrl: text(200)
    .optional()
    .transform((value) => (value ? value : undefined))
    .pipe(z.url("Enter a full address, like https://yourshop.com").optional()),
  category: required(80),
  audience: required(600),
  productsSummary: required(800),
  personality: text(400).default(""),
  visualStyle: text(400).default(""),
  colours: text(200).default(""),
  market: required(80),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Use a three-letter code like USD"),
  goal: text(400).default(""),
  stage: z.enum(STAGES),
  fulfilment: z.enum(FULFILMENT),
  verifiedClaims: claimList.default([]),
  prohibitedClaims: claimList.default([]),
});

export type ProfileFacts = z.infer<typeof profileFactsSchema>;

const hex = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Use a six-digit hex colour like #632B39");

/** The Brand Blueprint. Generated, then entirely the owner's to edit. */
export const brandBlueprintSchema = z.object({
  positioning: required(600),
  idealCustomer: required(900),
  personality: z
    .array(z.object({ trait: required(60), inPractice: required(300) }))
    .min(3)
    .max(6),
  colourPalette: z
    .array(z.object({ name: required(40), hex, use: required(160) }))
    .min(3)
    .max(7),
  typography: z.object({
    headings: required(200),
    body: required(200),
    notes: text(400),
  }),
  copyTone: z.object({
    summary: required(500),
    doSay: z.array(required(160)).min(2).max(8),
    avoid: z.array(required(160)).min(2).max(8),
  }),
  photography: required(900),
  consistency: z.array(required(240)).min(3).max(10),
});

export type BrandBlueprint = z.infer<typeof brandBlueprintSchema>;

export interface BusinessProfile extends ProfileFacts {
  id: string;
  userId: string;
  logoPath: string | null;
  /** null until the blueprint has been generated or written. */
  brand: BrandBlueprint | null;
  /** Bumped on every save; generations remember which one they read. */
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileVersion {
  id: string;
  profileId: string;
  version: number;
  facts: ProfileFacts;
  brand: BrandBlueprint | null;
  note: string;
  createdAt: string;
}

/** What a generator is allowed to know about the business. */
export function profileForPrompt(profile: BusinessProfile) {
  return {
    brandName: profile.brandName,
    websiteUrl: profile.websiteUrl ?? null,
    category: profile.category,
    audience: profile.audience,
    productsSummary: profile.productsSummary,
    personality: profile.personality,
    visualStyle: profile.visualStyle,
    colours: profile.colours,
    market: profile.market,
    currency: profile.currency,
    goal: profile.goal,
    stage: profile.stage,
    fulfilment: profile.fulfilment,
    verifiedClaims: profile.verifiedClaims,
    prohibitedClaims: profile.prohibitedClaims,
    brand: profile.brand,
  };
}

export function profileFactsOf(profile: BusinessProfile): ProfileFacts {
  return {
    brandName: profile.brandName,
    websiteUrl: profile.websiteUrl,
    category: profile.category,
    audience: profile.audience,
    productsSummary: profile.productsSummary,
    personality: profile.personality,
    visualStyle: profile.visualStyle,
    colours: profile.colours,
    market: profile.market,
    currency: profile.currency,
    goal: profile.goal,
    stage: profile.stage,
    fulfilment: profile.fulfilment,
    verifiedClaims: profile.verifiedClaims,
    prohibitedClaims: profile.prohibitedClaims,
  };
}
