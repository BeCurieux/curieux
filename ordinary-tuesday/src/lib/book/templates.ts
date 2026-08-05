// The twelve page archetypes (brief §9).
//
// Not hundreds of bespoke layouts — a small set of editorial archetypes the
// layout engine composes. The test for each one: would this page still feel
// beautiful if it appeared in an art book?
//
// Every archetype declares the image tier it needs, so a poor phone photo is
// placed at a size its resolution can honestly carry rather than stretched to
// fill a slot. That is the difference between an edited book and a filled
// template.

import type { ImageTier } from "./format";

export type ArchetypeId =
  | "chapter_opener"
  | "hero_photograph"
  | "portrait_plus_story"
  | "two_photo_sequence"
  | "three_photo_sequence"
  | "quote_page"
  | "object_portrait"
  | "little_things"
  | "people_page"
  | "ordinary_days"
  | "then_now"
  | "closing_page";

export interface Archetype {
  id: ArchetypeId;
  name: string;
  photoSlots: number;
  /** Smallest image quality this layout can honestly carry. */
  minTier: ImageTier;
  /** Roughly how much of the page is ink — drives pacing. */
  density: "sparse" | "medium" | "dense";
  /** Words of narrative this layout expects (brief §13). */
  wordBudget: [min: number, max: number];
}

export const ARCHETYPES: Record<ArchetypeId, Archetype> = {
  chapter_opener: {
    id: "chapter_opener", name: "Chapter opener",
    photoSlots: 0, minTier: "unprintable", density: "sparse", wordBudget: [20, 80],
  },
  hero_photograph: {
    id: "hero_photograph", name: "Hero photograph",
    photoSlots: 1, minTier: "hero", density: "sparse", wordBudget: [0, 20],
  },
  portrait_plus_story: {
    id: "portrait_plus_story", name: "Portrait and story",
    photoSlots: 1, minTier: "editorial", density: "medium", wordBudget: [40, 120],
  },
  two_photo_sequence: {
    id: "two_photo_sequence", name: "Two-photo sequence",
    photoSlots: 2, minTier: "editorial", density: "medium", wordBudget: [3, 30],
  },
  three_photo_sequence: {
    id: "three_photo_sequence", name: "Three-photo sequence",
    photoSlots: 3, minTier: "intimate", density: "medium", wordBudget: [3, 30],
  },
  quote_page: {
    id: "quote_page", name: "Quote",
    photoSlots: 0, minTier: "unprintable", density: "sparse", wordBudget: [1, 25],
  },
  object_portrait: {
    id: "object_portrait", name: "Object portrait",
    photoSlots: 1, minTier: "intimate", density: "sparse", wordBudget: [20, 90],
  },
  little_things: {
    id: "little_things", name: "The little things",
    photoSlots: 0, minTier: "unprintable", density: "dense", wordBudget: [30, 160],
  },
  people_page: {
    id: "people_page", name: "One relationship",
    photoSlots: 1, minTier: "editorial", density: "medium", wordBudget: [40, 120],
  },
  ordinary_days: {
    id: "ordinary_days", name: "Ordinary days",
    photoSlots: 4, minTier: "intimate", density: "dense", wordBudget: [10, 60],
  },
  then_now: {
    id: "then_now", name: "Then and now",
    photoSlots: 2, minTier: "editorial", density: "sparse", wordBudget: [3, 40],
  },
  closing_page: {
    id: "closing_page", name: "Closing",
    photoSlots: 1, minTier: "editorial", density: "sparse", wordBudget: [30, 120],
  },
};

export const ALL_ARCHETYPES = Object.values(ARCHETYPES);

export function getArchetype(id: string): Archetype {
  const a = ARCHETYPES[id as ArchetypeId];
  if (!a) throw new Error(`unknown archetype: ${id}`);
  return a;
}

const TIER_RANK: Record<ImageTier, number> = {
  unprintable: 0, intimate: 1, editorial: 2, hero: 3,
};

export function tierSatisfies(available: ImageTier, required: ImageTier): boolean {
  return TIER_RANK[available] >= TIER_RANK[required];
}

/**
 * The largest honest placement for a single photograph (brief §14).
 * A hero-quality image earns a full page; a poor but important one becomes an
 * object portrait — small, surrounded by white space, carried by its story.
 * Nothing is ever enlarged past what its pixels support.
 */
export function archetypeForSinglePhoto(tier: ImageTier, hasStory: boolean): ArchetypeId {
  if (tier === "hero" && !hasStory) return "hero_photograph";
  if (tierSatisfies(tier, "editorial")) return "portrait_plus_story";
  if (tier === "intimate") return "object_portrait";
  return "quote_page"; // nothing printable — let words carry the page
}

/** Layouts a page may swap to without losing content (brief §15). */
export function compatibleArchetypes(id: ArchetypeId, tier: ImageTier): Archetype[] {
  const current = getArchetype(id);
  return ALL_ARCHETYPES.filter(
    (a) => a.photoSlots === current.photoSlots && tierSatisfies(tier, a.minTier)
  );
}
