// The sample volume.
//
// One volume definition, imported by everything that renders it: the press
// PDF, the page PNGs, and the spreads the landing page shows. It used to
// live inside scripts/sample-book.ts, and the PNG renderer got at it by
// slicing that file's *source text* between two hard-coded landmarks and
// writing the result out as a generated module. That worked until somebody
// moved a line.
//
// The content is fiction. Florence is invented, her rabbit is invented, and
// the photographs are generated — no real child's imagery is used anywhere
// in this project. What is real is the path: these pages go through the
// production renderer, the real archetypes, the real colour system and the
// real preflight, so a spread on the website is a spread off the press.

import type { RenderPage } from "../pdf/html";
import { colourForAge } from "./colours";

// Stand-in photographs.
//
// No real child's imagery is used anywhere in this project (brief §32), and
// outbound image hosts are blocked, so these are generated. They are built to
// have the things that actually matter for judging a layout: a real tonal
// range, a subject mass separated from its ground, and a vignette. Grain is
// deliberately omitted — an SVG noise filter rasterises at full page size and
// pushed the sample PDF to 91MB.
// Flat grey rectangles cannot tell you whether a page works; these can.

interface Scene { sky: string; mid: string; ground: string; subject: string; warmth: number; }

const SCENES: Scene[] = [
  // kitchen morning — warm, low contrast
  { sky: "#E8DCC6", mid: "#C9B393", ground: "#8E7659", subject: "#D9C4A5", warmth: 0.9 },
  // garden, overcast — cool green
  { sky: "#CBD4C6", mid: "#93A388", ground: "#5C6B52", subject: "#B4C0A6", warmth: 0.3 },
  // beach — pale, bright, high key
  { sky: "#DCE4E7", mid: "#C4CDD1", ground: "#A9A491", subject: "#E4DED0", warmth: 0.6 },
  // bath / indoor evening — deep, warm shadow
  { sky: "#B9A48C", mid: "#8A7460", ground: "#4E4034", subject: "#CBB89F", warmth: 1.0 },
  // pool — cool blue-green
  { sky: "#BBCBCE", mid: "#7E9BA1", ground: "#3F5B62", subject: "#CFDADA", warmth: 0.2 },
  // living room, curtain light — neutral
  { sky: "#DAD6CC", mid: "#B3ADA1", ground: "#78716A", subject: "#C8C1B4", warmth: 0.5 },
];

/**
 * A stand-in photograph.
 *
 * Exported because the website needs the same thing the book does. The
 * homepage shows a camera roll of nine frames, and its first version used
 * flat blocks of the annual colours — which read as a paint chart rather
 * than as somebody's photographs, and made the strongest section on the page
 * look like a design system. These at least have a tonal range, a subject
 * separated from its ground and a vignette, which is the minimum for a
 * rectangle to read as a photograph at thumbnail size.
 *
 * They are still stand-ins, and the page says so.
 */
export function photo(seed: number, w = 2400, h = 3200): string {
  const s = SCENES[seed % SCENES.length];
  const portrait = h >= w;
  // Subject sits off-centre, alternating side, the way real photographs do.
  const cx = seed % 2 === 0 ? 0.42 : 0.58;
  const cy = portrait ? 0.44 : 0.48;
  const r = portrait ? 0.34 : 0.42;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 100 ${Math.round((h / w) * 100)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.15" y2="1">
      <stop offset="0" stop-color="${s.sky}"/>
      <stop offset="0.55" stop-color="${s.mid}"/>
      <stop offset="1" stop-color="${s.ground}"/>
    </linearGradient>
    <radialGradient id="subj" cx="${cx}" cy="${cy}" r="${r}">
      <stop offset="0" stop-color="${s.subject}" stop-opacity="0.95"/>
      <stop offset="0.6" stop-color="${s.subject}" stop-opacity="0.45"/>
      <stop offset="1" stop-color="${s.subject}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="vig" cx="0.5" cy="0.45" r="0.78">
      <stop offset="0.5" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.3"/>
    </radialGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="0.7"/></filter>
  </defs>

  <rect width="100%" height="100%" fill="url(#bg)"/>
  <!-- soft background masses, out of focus -->
  <g filter="url(#soft)" opacity="0.5">
    <ellipse cx="${18 + (seed % 5) * 6}" cy="${20 + (seed % 3) * 8}" rx="26" ry="14" fill="${s.sky}" opacity="0.7"/>
    <ellipse cx="${76 - (seed % 4) * 5}" cy="${58 + (seed % 4) * 6}" rx="30" ry="20" fill="${s.ground}" opacity="0.5"/>
  </g>
  <rect width="100%" height="100%" fill="url(#subj)"/>
  <rect width="100%" height="100%" fill="url(#vig)"/>
</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

type B = RenderPage["blocks"][number];
const T = (type: B["type"], content: string): B => ({ type, content });

export interface Leaf {
  page: Omit<RenderPage, "pageNumber">;
  /**
   * True when this page carries a photograph that would, in a real copy, be
   * a photograph of the child.
   *
   * This is the whole point of the flag. Qotidia's promise is that a child's
   * photographs stay private and are never the product, so a marketing site
   * carrying a child's face contradicts itself in the one place everybody
   * looks — and stock photography is worse, because it is a stranger's child
   * impersonating a customer's.
   *
   * The book still has photographs of the child, obviously. It is a book
   * about a child. What this marks is which pages can be *photographed for
   * the website*, and the volume is arranged so that enough of those pages
   * face each other to make real spreads.
   */
  showsAChild: boolean;
  /** What the page is, for whoever is choosing what to shoot. */
  note: string;
}

const child = (note: string, page: Leaf["page"]): Leaf => ({ page, showsAChild: true, note });
const safe = (note: string, page: Leaf["page"]): Leaf => ({ page, showsAChild: false, note });

/**
 * The volume, in order.
 *
 * Re-cut for photography. The pages that carry no child — the quotes, the
 * chapter openers, the object portraits and the list of little things — are
 * arranged so that four of them fall as facing pairs: an even page and the
 * odd page after it, which is what a spread actually is. Those four are what
 * the website shows, and what a printed sample should be opened to.
 *
 * It is also better bookmaking. An object portrait of the boots opposite the
 * list of little things is a stronger spread than another photograph of a
 * toddler, and the objects are the part of a childhood nobody thinks to
 * keep — which is the argument the whole product is making.
 */
export const VOLUME: Leaf[] = [
  safe("Chapter one opens.", { archetype: "chapter_opener", hideFolio: true, blocks: [
    T("label", "One"), T("heading", "This was you at two"),
    T("text", "You lived in the grey house with the broken gate. You were two in April. By June you had opinions about boots.")] }),
  child("Full-bleed portrait.", { archetype: "hero_photograph", hideFolio: true, blocks: [T("photo", photo(1))] }),
  child("At the front window, waiting for the truck.", { archetype: "portrait_plus_story", blocks: [
    T("photo", photo(2, 2400, 1800)), T("caption", "The front window, most mornings"),
    T("text", "You could hear the truck three streets away. You would stop whatever you were doing and stand at the window, completely still, until it had gone past.")] }),

  // ── spread 4|5 ─ a sentence alone, facing a chapter opening.
  safe("A quote given a whole page.", { archetype: "quote_page", blocks: [
    T("quote", "I do it my byself."), T("annotation", "Florence, 2 years 4 months")] }),
  safe("Chapter two opens, on terracotta.", { archetype: "chapter_opener", hideFolio: true, blocks: [
    T("label", "Two"), T("heading", "The year of Bun Bun"),
    T("text", "A blue rabbit, one ear longer than the other, in roughly a third of every photograph taken this year.")] }),

  // ── spread 6|7 ─ the rabbit, facing what she said about the moon.
  safe("The rabbit, photographed as an object.", { archetype: "object_portrait", blocks: [
    T("photo", photo(3, 900, 1200)), T("caption", "Bun Bun, after the wash"),
    T("text", "He went through the machine in August. It was an emotional afternoon. He came back slightly paler and has been favoured ever since.")] }),
  safe("A quote given a whole page.", { archetype: "quote_page", blocks: [
    T("quote", "Moon gone to work."), T("annotation", "Florence, 2 years 7 months")] }),

  child("Three frames from a week at the beach.", { archetype: "three_photo_sequence", blocks: [
    T("photo", photo(4, 1600, 1600)), T("photo", photo(5, 1600, 1600)), T("photo", photo(6, 1600, 1600)),
    T("caption", "Beach week — the bucket was for shells; the shells were for Bun Bun")] }),
  child("Grandpa, and Thursdays.", { archetype: "people_page", blocks: [
    T("label", "Your people"), T("heading", "Grandpa"),
    T("photo", photo(7, 2000, 1500)), T("caption", "Thursday, most weeks"),
    T("text", "Thursdays were his. You watered every pot on the back step, in order, and then you had a biscuit. He taught you to whistle in September. It is more of a hiss, but you are committed.")] }),
  child("The same spot, eight months apart.", { archetype: "two_photo_sequence", blocks: [
    T("photo", photo(8, 1800, 2400)), T("photo", photo(9, 1800, 2400)),
    T("caption", "March, and again in November")] }),
  safe("Chapter three opens.", { archetype: "chapter_opener", hideFolio: true, blocks: [
    T("label", "Three"), T("heading", "The yellow boots")] }),

  // ── spread 12|13 ─ the boots themselves, facing the little things.
  //    The best spread in the book and the one with no child in it.
  safe("The boots, photographed as an object.", { archetype: "object_portrait", blocks: [
    T("photo", photo(0, 900, 1200)), T("caption", "The boots, in the hall, where they lived"),
    T("text", "Bought a size too big in March. Worn to the sandpit, the supermarket, dinner at Grandma's — and once, unsuccessfully, to bed.")] }),
  safe("The list nobody thinks to write down.", { archetype: "little_things", blocks: [
    T("heading", "The little things"),
    T("text", "Currently eating: Strawberries. Constantly."),
    T("text", "Currently saying: \u201cI do it.\u201d"),
    T("text", "Currently carrying: Bun Bun."),
    T("text", "Currently avoiding: Any shoe that is not yellow."),
    T("text", "Bedtime requirement: Exactly three songs."),
    T("text", "Currently believes: The moon has gone to work."),
    T("text", "Favourite person: Grandpa, on Thursdays."),
    T("text", "Current project: Whistling.")] }),

  child("Full-bleed portrait, boots on.", { archetype: "hero_photograph", hideFolio: true, blocks: [T("photo", photo(10))] }),
  child("Wearing them somewhere they were not needed.", { archetype: "portrait_plus_story", blocks: [
    T("photo", photo(11, 2400, 1800)), T("caption", "Not raining. Not once."),
    T("text", "For four months, only the yellow boots would do. Sandpit, supermarket, dinner at Grandma\u2019s \u2014 and once, unsuccessfully, bed.")] }),

  // ── spread 16|17 ─ the bedtime rule, facing the cup she demanded.
  safe("A quote given a whole page.", { archetype: "quote_page", blocks: [
    T("quote", "Three songs. Then one more three songs."), T("annotation", "Florence, 2 years 11 months")] }),
  safe("The breakfast cup, photographed as an object.", { archetype: "object_portrait", blocks: [
    T("photo", photo(5, 900, 1200)), T("caption", "The blue cup. Only the blue cup."),
    T("text", "There were four cups in the house. Three of them were wrong, and nobody was ever able to establish why.")] }),

  child("Four ordinary days.", { archetype: "ordinary_days", blocks: [
    T("heading", "Ordinary days"),
    T("photo", photo(12, 1400, 1400)), T("photo", photo(13, 1400, 1400)),
    T("photo", photo(14, 1400, 1400)), T("photo", photo(15, 1400, 1400)),
    T("caption", "Breakfast \u00b7 the walk \u00b7 the kitchen bench \u00b7 bath")] }),
  child("January against December.", { archetype: "then_now", blocks: [
    T("photo", photo(16, 1800, 2400)), T("photo", photo(17, 1800, 2400)),
    T("annotation", "January"), T("annotation", "December")] }),
  child("The last page.", { archetype: "closing_page", blocks: [
    T("photo", photo(18, 2000, 1500)), T("heading", "At the end of two"),
    T("text", "You are two and eleven months. You can nearly whistle. You still will not wear the blue boots, and nobody has tried to make you in some time."),
    T("annotation", "This volume was closed in April.")] }),
];

export const PAGES: Omit<RenderPage, "pageNumber">[] = VOLUME.map((leaf) => leaf.page);

/** The volume, page-numbered, ready for renderBookHtml(). */
export const SAMPLE_PAGES: RenderPage[] = PAGES.map((p, i) => ({ ...p, pageNumber: i + 1 }));

export interface Spreadable {
  /** Interior page numbers. Always an even page facing the odd one after it. */
  left: number;
  right: number;
  /** What the pair is, joined. */
  what: string;
}

/**
 * Every facing pair with no child on either page.
 *
 * A spread is a verso and the recto after it — an even page and the odd one
 * following. Pairing 3 with 4 is two pages that never face each other, and
 * would show a relationship the printed book does not have.
 *
 * This is the list the website chooses from, and the list to open a printed
 * sample to when photographing it.
 */
export function photographableSpreads(): Spreadable[] {
  const out: Spreadable[] = [];
  for (let left = 2; left < VOLUME.length; left += 2) {
    const a = VOLUME[left - 1];
    const b = VOLUME[left];
    if (!a || !b || a.showsAChild || b.showsAChild) continue;
    out.push({ left, right: left + 1, what: `${a.note} ${b.note}` });
  }
  return out;
}

export const SAMPLE_BOOK = {
  cover: {
    childName: "Florence",
    ageWord: "TWO",
    year: "2028",
    imprint: "Qotidia",
    colour: colourForAge(2),
    spineWidthMm: 12.8,
  },
  pages: SAMPLE_PAGES,
};
