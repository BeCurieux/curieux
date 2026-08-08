// Photographs of the object, when there are any.
//
// The site's problem, stated plainly: every image on it is something we
// rendered. A row of cover artwork communicates "here is our product
// design". A photograph of the same books on a shelf in somebody's house
// communicates "I can imagine these in mine in ten years", and that is the
// whole jump the design direction is asking for. No amount of layout closes
// that gap.
//
// So rather than hard-code paths that break the page until the files exist,
// each slot names a photograph and a fallback. The check happens on the
// server at render time, so the page is never broken and never waiting: drop
// a file in and it appears, remove it and the render comes back.
//
// A note on what these are allowed to claim. Rendered mockups are a normal
// way to show a product that has not been manufactured yet, and nothing here
// captions them as photographs of a printed copy. What they must not do is
// imply a material nobody has confirmed — no foil, no cloth, no deboss, no
// edge staining. Until a Prodigi sample comes back, the finish in any image
// used here is a proposal, and the site says nothing about it either way.

import { existsSync } from "node:fs";
import { join } from "node:path";

export interface MarketingImage {
  /** Where the photograph goes if it exists. */
  src: string;
  /** Used when it does not. Always something already in the repo. */
  fallback: string;
  alt: string;
  /** True when the real photograph is in place. */
  isPhoto: boolean;
}

/**
 * Extensions a slot will accept, in preference order.
 *
 * Any of them, because the failure this avoids is the worst kind: someone
 * uploads book-hero.png, the page keeps showing the fallback, and nothing
 * anywhere says why. Whoever adds these images should not have to know that
 * a constant in this file said ".jpg".
 */
const ACCEPTED = ["jpg", "jpeg", "png", "webp", "avif"];

/** Resolve a slot against what is actually on disk right now. */
function slot(name: string, fallback: string, alt: string): MarketingImage {
  for (const ext of ACCEPTED) {
    const file = `${name}.${ext}`;
    if (existsSync(join(process.cwd(), "public", "sample", file))) {
      return { src: `/sample/${file}`, fallback, alt, isPhoto: true };
    }
  }
  return { src: fallback, fallback, alt, isPhoto: false };
}

/**
 * The slots the site reads, in the order they appear on the page.
 *
 * Each one is a specific photograph rather than a category, because "some
 * lifestyle imagery" produces a stock library and this needs about a dozen
 * frames that look like the same house on the same afternoon.
 */
export const MARKETING = {
  /** Hero. An open book, held or resting, in ordinary daylight. */
  hero: () =>
    slot("book-hero", "/sample/age-02.png", "An open Qotidia volume — the year you were two"),
  /** The shelf. Several years together, in a real room. */
  shelf: () =>
    slot("book-shelf", "/sample/age-02.png", "A row of Qotidia volumes on a shelf at home"),
  /** Sits inside the ink band, so it wants a dark-ground frame. */
  dark: () =>
    slot("book-dark", "/sample/age-07.png", "A Qotidia volume by lamplight"),
  /** Overhead, for anywhere a wide crop is needed. */
  flat: () =>
    slot("book-flat", "/sample/age-04.png", "A Qotidia volume from above"),
  /** Macro. Cover stock, board edge, the grain of the paper. */
  texture: () =>
    slot("book-texture", "/sample/age-05.png", "The cover of a Qotidia volume, close up"),
  /** Hands. A parent holding it open, or a child touching a photograph. */
  hands: () =>
    slot("book-hands", "/sample/age-03.png", "A parent and child looking through a Qotidia volume"),
  /** The book among ordinary things — glasses, a cup, a toy. */
  lived: () =>
    slot("book-lived", "/sample/age-06.png", "A Qotidia volume on a table among the day's things"),
};

export type SlotName = keyof typeof MARKETING;

/** Which of them are real photographs right now. */
export function photographsInPlace(): SlotName[] {
  return (Object.keys(MARKETING) as SlotName[]).filter((k) => MARKETING[k]().isPhoto);
}

/** Where to put them, printed in the README so it is not folklore. */
export const IMAGERY_PATH = "qotidia/public/sample/";

/**
 * The shot list, kept in the repository rather than in a message.
 *
 * Written as direction rather than as a list of nouns, because the
 * difference between this working and not working is entirely in how the
 * frames are made. Some of them should look like a photographer came across
 * the book in someone's house — not like campaign photography.
 */
export const SHOT_LIST: { slot: SlotName | "spread"; file: string; brief: string }[] = [
  {
    slot: "hero",
    file: "book-hero",
    brief:
      "An open volume on a sofa, bed or kitchen table. Natural window light, " +
      "not golden hour. A page curling slightly, a child's photograph visible " +
      "on the spread. Shallow depth of field, slightly off-centre. Close " +
      "enough that the paper grain and the binding read.",
  },
  {
    slot: "shelf",
    file: "book-shelf",
    brief:
      "Four or five annual volumes together on a real shelf in a real room, " +
      "with whatever else lives on that shelf. The colours doing their job. " +
      "Shot slightly off-square, not straight on.",
  },
  {
    slot: "hands",
    file: "book-hands",
    brief:
      "A parent and child looking through it together, or a child's hand " +
      "flat on a photograph. Faces optional and not the point — the hands and " +
      "the page are. Nobody looking at the camera.",
  },
  {
    slot: "texture",
    file: "book-texture",
    brief:
      "Macro. The cover board, the page block edge, the fold at the spine. " +
      "Raking light so the stock has tooth. This is the shot that has to say " +
      "'this will still be here in twenty years'.",
  },
  {
    slot: "lived",
    file: "book-lived",
    brief:
      "The volume among the day's things — reading glasses, a half-drunk cup, " +
      "a toy on its side. Deliberately unstyled. This is the one that should " +
      "look found rather than made.",
  },
  {
    slot: "dark",
    file: "book-dark",
    brief:
      "A dark-ground frame for the privacy section: the book on a dark " +
      "surface or in low lamplight. A bright image dropped into that band " +
      "punches a hole in it.",
  },
  {
    slot: "flat",
    file: "book-flat",
    brief:
      "Overhead, closed, on a plain surface with a little room around it. " +
      "The utility crop — used wherever a wide banner is needed and nothing " +
      "more specific fits.",
  },
];

/**
 * What to avoid, also kept here.
 *
 * Every one of these is a way for the imagery to undo the positioning: a
 * beige influencer nursery says "parenting brand", perfect symmetry says
 * "stock", and a floating book with impossible page geometry says "we have
 * never actually made one of these".
 */
export const AVOID = [
  "beige-on-beige influencer nursery in every frame",
  "perfectly symmetrical props",
  "every scene in golden hour",
  "teddy bears and wooden toys arranged for the camera",
  "perfectly smooth spines and impossible page geometry",
  "books floating with no surface under them",
  "any generated frame where the printed text does not read correctly",
];
