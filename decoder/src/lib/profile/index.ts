/**
 * The five launch profiles.
 *
 * BRIEF.md §4: "Each niche = a distinct onboarding profile AND a distinct
 * creator community for seeding. The product is one app; the marketing is five
 * apps."
 *
 * These are the presets the onboarding quiz would produce, defined now because
 * the renderer needs them for the Phase 0 films and the engine needs them for
 * its tests. The quiz itself is behind the gate — a preset is data, a quiz is
 * an app.
 */

import { Profile } from "@/lib/schema";

export const PROFILES: Record<string, Profile> = {
  /** ICP 1. The highest-stakes profile, and the one §10.1 is written for. */
  "allergy-household": Profile.parse({
    id: "allergy-household",
    label: "Peanut and tree-nut household",
    allergens: ["peanut", "tree-nut"],
  }),

  /** ICP 1, the other common shape: dairy and egg, usually a young child. */
  "dairy-egg-household": Profile.parse({
    id: "dairy-egg-household",
    label: "Dairy and egg allergy",
    allergens: ["milk", "egg"],
  }),

  /** ICP 2. The seed-oil and additive audience — the TikTok discourse niche. */
  "clean-label": Profile.parse({
    id: "clean-label",
    label: "Clean label",
    avoidances: [
      "seed-oils",
      "artificial-colours",
      "artificial-sweeteners",
      "artificial-preservatives",
      "titanium-dioxide",
    ],
  }),

  /** ICP 3. A defined list, a defined window, a very motivated user. */
  pregnancy: Profile.parse({
    id: "pregnancy",
    label: "Pregnancy",
    lifeStages: ["pregnancy"],
    avoidances: ["artificial-sweeteners"],
  }),

  /** ICP 4, in its two most common forms. */
  keto: Profile.parse({
    id: "keto",
    label: "Keto",
    protocols: ["keto"],
    avoidances: ["added-sugar"],
  }),
  vegan: Profile.parse({
    id: "vegan",
    label: "Vegan",
    protocols: ["vegan"],
  }),
  "low-fodmap": Profile.parse({
    id: "low-fodmap",
    label: "Low-FODMAP",
    protocols: ["low-fodmap"],
  }),

  /** ICP 5. Supplement buyers care about what the label will not say. */
  supplements: Profile.parse({
    id: "supplements",
    label: "Supplement buyer",
    avoidances: ["artificial-colours", "artificial-sweeteners"],
  }),

  /**
   * Nobody's real profile. Used to show what the engine says when it has been
   * told nothing — which should be the umbrella terms and very little else,
   * because a profile-free verdict is close to meaningless and the product
   * should not pretend otherwise.
   */
  none: Profile.parse({ id: "none", label: "No profile set" }),
};

export function profileByName(name: string): Profile | undefined {
  return PROFILES[name];
}

export const PROFILE_NAMES = Object.keys(PROFILES);
