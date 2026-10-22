import type { ModuleKey } from "@/lib/domain/modules";

// Where each generator's method comes from.
//
// Her Little Empire already owns frameworks for most of these modules
// (Brand-in-a-Box, the Business Starter System, Your Little Offer Kit,
// Price It Right, the Faceless Content System…). The generators must be
// built on those, not on a generic method — see content/REGISTER.md.
//
// Those documents have not been supplied to this repository yet. Until they
// are, every module runs on an INTERIM method written for this build, and
// says so: the studio shows "Interim method" on the module, and the input
// snapshot of every generation records which method produced it, so outputs
// made before the real method lands can be found and regenerated.
//
// To convert a source document: reconstruct its method into `instructions`
// below (keeping its steps, terms and caveats), set `status: "source"`,
// list the asset ids from content/register.json in `sources`, and bump
// `version`.

export interface Methodology {
  status: "interim" | "source";
  version: string;
  /** Asset ids in content/register.json this method should come from. */
  sources: string[];
  instructions: string;
}

export const METHODOLOGY: Record<ModuleKey, Methodology> = {
  brand_blueprint: {
    status: "interim",
    version: "interim-1",
    sources: ["brand-in-a-box", "business-starter-system"],
    instructions: `Build the blueprint from what she told us, in this order:
1. Positioning: who it's for, what it is, why it's different — one or two sentences, no superlatives.
2. Ideal customer: her situation, what she wants, what gets in her way, where she shops.
3. Three to five personality traits, each with what it means in practice for copy and visuals.
4. A palette of four to six colours with a job for each (background, text, accent, button). Prefer colours she named. Text and background colours must have strong contrast.
5. Typography direction (heading and body styles; name free Shopify-available fonts where possible).
6. Copy tone: a summary, phrases that sound like her, things to avoid.
7. Photography direction tied to the palette and personality.
8. Consistency rules she can check any new asset against.`,
  },
  theme_brief: {
    status: "interim",
    version: "interim-1",
    sources: ["business-starter-system"],
    instructions: `Plan a beginner-friendly Shopify homepage that a free theme (e.g. Dawn) can build with standard sections. Keep navigation short. Every section needs a job. Include mobile, accessibility and trust guidance a first-time owner can act on.`,
  },
  theme_prompts: {
    status: "interim",
    version: "interim-1",
    sources: ["business-starter-system"],
    instructions: `Write prompts for Shopify Sidekick in the theme editor. Each prompt asks for one change, names the section type, gives the exact copy and colours to use, and stops short of publishing. Tell her what to check afterwards and how likely it is she'll need to adjust by hand.`,
  },
  homepage_copy: {
    status: "interim",
    version: "interim-1",
    sources: ["business-starter-system", "your-little-offer-kit"],
    instructions: `Write homepage copy that says who it's for and what it is in the first screen. Short sentences. One clear action. Value props are benefits she has evidence for. Leave placeholders in [brackets] for anything we don't know.`,
  },
  product_listing: {
    status: "interim",
    version: "interim-1",
    sources: ["your-little-offer-kit", "price-it-right"],
    instructions: `Lead with the customer's problem and the outcome, then the facts. Bullets pair a real feature with its benefit. Specifications only from supplied facts. SEO title under 70 characters; meta description under 160. Flag every missing fact.`,
  },
  image_briefs: {
    status: "interim",
    version: "interim-1",
    sources: ["brand-in-a-box"],
    instructions: `Write shoot briefs a beginner can follow with a phone and daylight. Describe only the real product as she described it. Every brief says what to avoid. Image-editing prompts change backgrounds and settings only — never the product, its label or its size.`,
  },
  email_sequence: {
    status: "interim",
    version: "interim-1",
    sources: ["first-5-customers"],
    instructions: `A launch announcement and three emails: the story and the why; the product and who it's for; a friendly reminder with practical details. No countdowns or invented deadlines. One call to action each.`,
  },
  social_content: {
    status: "interim",
    version: "interim-1",
    sources: ["faceless-content-system", "100-faceless-hooks", "30-day-faceless-content-plan"],
    instructions: `Launch content that works without showing her face: hands, product, process, flat lays, text-led Reels. Hooks are specific to her customer's problem. The seven-day calendar builds from story to product to launch to follow-up.`,
  },
};
