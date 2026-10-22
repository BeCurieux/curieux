import { z } from "zod";
import { brandBlueprintSchema } from "./profile";

// Every generator, its output schema, and how the studio presents it.
//
// One schema per module, never one big prompt: each generator is validated
// on its own and rendered in its own editor. Outputs that fail validation
// are rejected, not shown (src/lib/generation/run.ts).
//
// `kind` is what the customer is holding, said plainly in the UI:
//   copy        — finished words she can paste into her store or inbox
//   instruction — something to give to a tool (Shopify Sidekick, Canva, an
//                 image editor); the result depends on that tool
//   brief       — a plan for a photo shoot; not a photograph

const s = (max: number) => z.string().trim().min(1).max(max);
const list = (max: number, min = 1, item = 300) => z.array(s(item)).min(min).max(max);
const qa = z.object({ question: s(200), answer: s(800) });

export const SIDEKICK_PROMPT_KEYS = [
  "global_design",
  "hero",
  "announcement_bar",
  "featured",
  "benefits",
  "product_page",
  "faq",
  "about",
  "email_signup",
  "footer_nav",
] as const;
export type SidekickPromptKey = (typeof SIDEKICK_PROMPT_KEYS)[number];

export const SIDEKICK_PROMPT_TITLES: Record<SidekickPromptKey, string> = {
  global_design: "Global design settings",
  hero: "Homepage hero",
  announcement_bar: "Announcement bar",
  featured: "Featured products or collections",
  benefits: "Product benefits",
  product_page: "Product page layout",
  faq: "FAQ section",
  about: "About the brand",
  email_signup: "Email signup section",
  footer_nav: "Footer and navigation",
};

export const themeBriefSchema = z.object({
  homepageObjective: s(600),
  customerPositioning: s(600),
  visualDirection: s(900),
  navigation: z
    .array(z.object({ label: s(40), purpose: s(240) }))
    .min(2)
    .max(8),
  homepageSections: z
    .array(z.object({ section: s(80), purpose: s(300), content: s(600) }))
    .min(3)
    .max(12),
  productPage: list(10),
  mobile: list(10),
  conversion: list(10),
  accessibility: list(10),
  trust: list(10),
});

export const sidekickPromptSchema = z.object({
  key: z.enum(SIDEKICK_PROMPT_KEYS),
  title: s(80),
  whereToUse: s(400),
  whatItChanges: s(400),
  themeDependency: s(400),
  prompt: s(2500),
  verify: list(8),
  review: s(500),
  manualAdjustments: z.enum(["unlikely", "possible", "likely"]),
  manualNote: s(400),
});

export const themePromptsSchema = z.object({
  beforeYouStart: list(8),
  prompts: z.array(sidekickPromptSchema).min(1).max(SIDEKICK_PROMPT_KEYS.length),
});

export const homepageCopySchema = z.object({
  announcementBar: s(140),
  heroHeadline: s(120),
  heroSubheadline: s(300),
  primaryCta: s(40),
  secondaryCta: s(40),
  valueProps: z
    .array(z.object({ title: s(80), body: s(300) }))
    .min(2)
    .max(5),
  featuredCollectionIntro: s(400),
  aboutBlurb: s(1200),
  emailSignupHeadline: s(120),
  emailSignupBody: s(300),
  faq: z.array(qa).min(2).max(8),
  footerTagline: s(160),
  needsYourInput: z.array(s(300)).max(10),
});

export const productListingSchema = z.object({
  title: s(120),
  shortDescription: s(400),
  description: s(3000),
  bullets: z
    .array(z.object({ feature: s(120), benefit: s(240) }))
    .min(2)
    .max(8),
  specifications: z.array(z.object({ label: s(60), value: s(300) })).max(15),
  faq: z.array(qa).min(1).max(8),
  seoTitle: s(70),
  seoDescription: s(160),
  collectionDescription: s(600),
  socialCaption: s(600),
  missingInformation: z.array(s(300)).max(15),
});

const imageBriefSchema = z.object({
  purpose: s(300),
  setup: s(800),
  background: s(300),
  lighting: s(300),
  composition: s(500),
  props: z.array(s(120)).max(8),
  aspectRatio: s(120),
  shotList: list(8),
  avoid: list(8),
});

export const imageBriefsSchema = z.object({
  accuracyNote: s(600),
  primary: imageBriefSchema,
  detail: imageBriefSchema,
  lifestyle: imageBriefSchema,
  instagram: imageBriefSchema,
  canvaSteps: list(12),
  aiEditPrompts: z.array(z.object({ purpose: s(160), prompt: s(1200), caution: s(400) })).max(5),
});

const emailSchema = z.object({
  sendTiming: s(120),
  subject: s(120),
  previewText: s(160),
  body: s(3000),
  cta: s(60),
});

export const emailSequenceSchema = z.object({
  launchAnnouncement: z.object({ headline: s(160), body: s(1500) }),
  emails: z.array(emailSchema).length(3),
});

export const socialContentSchema = z.object({
  reels: z
    .array(
      z.object({
        title: s(100),
        hook: s(200),
        beats: list(8),
        onScreenText: s(300),
        caption: s(800),
      }),
    )
    .length(5),
  captions: z.array(z.object({ caption: s(1200), hashtags: z.array(s(40)).max(12) })).length(5),
  carousels: z.array(z.object({ title: s(120), slides: list(10, 3) })).length(3),
  ctas: list(8, 3),
  calendar: z
    .array(
      z.object({
        day: z.number().int().min(1).max(7),
        channel: s(60),
        content: s(400),
        goal: s(200),
      }),
    )
    .length(7),
  faq: z.array(qa).min(3).max(8),
});

export const MODULE_KEYS = [
  "brand_blueprint",
  "theme_brief",
  "theme_prompts",
  "homepage_copy",
  "product_listing",
  "image_briefs",
  "email_sequence",
  "social_content",
] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

export const MODULE_SCHEMAS = {
  brand_blueprint: brandBlueprintSchema,
  theme_brief: themeBriefSchema,
  theme_prompts: themePromptsSchema,
  homepage_copy: homepageCopySchema,
  product_listing: productListingSchema,
  image_briefs: imageBriefsSchema,
  email_sequence: emailSequenceSchema,
  social_content: socialContentSchema,
} as const satisfies Record<ModuleKey, z.ZodType>;

export type ModuleOutput<M extends ModuleKey> = z.infer<(typeof MODULE_SCHEMAS)[M]>;
export type AnyModuleOutput = ModuleOutput<ModuleKey>;

export type AssetKind = "copy" | "instruction" | "brief" | "plan";
export type Studio = "brand" | "theme" | "products" | "mockups" | "marketing";

export interface ModuleInfo {
  key: ModuleKey;
  title: string;
  studio: Studio;
  /** Product modules run once per product; the rest once per business. */
  scope: "profile" | "product";
  kind: AssetKind;
  summary: string;
}

export const MODULES: Record<ModuleKey, ModuleInfo> = {
  brand_blueprint: {
    key: "brand_blueprint",
    title: "Brand Blueprint",
    studio: "brand",
    scope: "profile",
    kind: "plan",
    summary: "Positioning, customer, personality, palette, type, tone and photo direction.",
  },
  theme_brief: {
    key: "theme_brief",
    title: "Store design brief",
    studio: "theme",
    scope: "profile",
    kind: "plan",
    summary: "What your homepage is for, the sections it needs, and what to check on mobile.",
  },
  theme_prompts: {
    key: "theme_prompts",
    title: "Sidekick prompt pack",
    studio: "theme",
    scope: "profile",
    kind: "instruction",
    summary: "Ten prompts to paste into Shopify Sidekick, each with what to check afterwards.",
  },
  homepage_copy: {
    key: "homepage_copy",
    title: "Homepage copy",
    studio: "theme",
    scope: "profile",
    kind: "copy",
    summary: "Hero, announcement bar, value props, about, signup and FAQ — ready to paste.",
  },
  product_listing: {
    key: "product_listing",
    title: "Product listing",
    studio: "products",
    scope: "product",
    kind: "copy",
    summary: "Title, descriptions, bullets, specs, FAQ, SEO and a collection blurb.",
  },
  image_briefs: {
    key: "image_briefs",
    title: "Photo and mockup briefs",
    studio: "mockups",
    scope: "product",
    kind: "brief",
    summary: "Shot plans for hero, detail, lifestyle and Instagram images, plus Canva steps.",
  },
  email_sequence: {
    key: "email_sequence",
    title: "Launch emails",
    studio: "marketing",
    scope: "profile",
    kind: "copy",
    summary: "A launch announcement and a three-email launch sequence.",
  },
  social_content: {
    key: "social_content",
    title: "Social launch kit",
    studio: "marketing",
    scope: "profile",
    kind: "copy",
    summary: "Five Reels, five captions, three carousels, CTAs, a 7-day calendar and an FAQ.",
  },
};

export const KIND_LABELS: Record<AssetKind, { label: string; explain: string }> = {
  copy: {
    label: "Finished copy",
    explain: "Words you can paste straight into your store, inbox or socials. Read them first.",
  },
  instruction: {
    label: "Instructions for a tool",
    explain:
      "Prompts you give to Shopify Sidekick. What it does depends on your theme — review every change before you publish.",
  },
  brief: {
    label: "A brief, not a photo",
    explain:
      "A plan for shooting or editing your own product photos. Check every image matches the real product before you use it.",
  },
  plan: {
    label: "Plan and direction",
    explain: "Decisions and guidelines that steer everything else. Edit freely — it's yours.",
  },
};

export function validateOutput<M extends ModuleKey>(module: M, value: unknown): ModuleOutput<M> {
  return MODULE_SCHEMAS[module].parse(value) as ModuleOutput<M>;
}

export function isModuleKey(value: string): value is ModuleKey {
  return (MODULE_KEYS as readonly string[]).includes(value);
}
