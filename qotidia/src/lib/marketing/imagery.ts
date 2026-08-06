// Photographs of the object, when there are any.
//
// The landing page has always had a hole where a picture of the book should
// be, and has been filling it with the cover render — which is honest but
// flat: it shows the artwork, not the thing. A photograph shows thickness,
// a page block, light falling across a matte laminate, and a book sitting
// somewhere a book actually sits.
//
// Rather than hard-code paths that break the page until the files exist,
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
 * The four slots, in the order they matter.
 *
 * hero        — the object, alone, in daylight. Wants the calmest of the
 *               set: minimal props, visible page block, plenty of air. It
 *               carries the top of the page and should not look styled.
 * shelf       — the book somewhere domestic. Warm, lived-in, a real surface.
 * dark        — sits inside the ink band on the privacy section. A
 *               dark-ground photograph against a dark ground is the one art
 *               direction decision here worth making deliberately: a bright
 *               image dropped into that band would punch a hole in it.
 * flat        — overhead, for anywhere a wide crop is needed.
 */
export const MARKETING = {
  hero: () => slot("book-hero", "/sample/age-02.png", "A Qotidia volume — the year you were two"),
  shelf: () => slot("book-shelf", "/sample/age-02.png", "A Qotidia volume on a shelf at home"),
  dark: () => slot("book-dark", "/sample/age-07.png", "A Qotidia volume by candlelight"),
  flat: () => slot("book-flat", "/sample/age-04.png", "A Qotidia volume from above"),
};

/** Where to put them, printed in the README so it is not folklore. */
export const IMAGERY_PATH = "qotidia/public/sample/";
