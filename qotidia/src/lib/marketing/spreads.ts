// Which spreads the website shows.
//
// Named here rather than in the render script, because the page and the
// renderer have to agree about what exists. When they disagreed, the failure
// was a broken image on the landing page — which the build does not catch,
// the tests did not catch, and only a person looking at the page would ever
// see.
//
// Three, chosen to show that the book has more than one idea in it. A reader
// deciding whether to spend A$199 is trying to work out whether this is a
// designed object or a photo dump with a hard cover, and three near-identical
// grids of photographs answers that question the wrong way.

export interface Spread {
  /** File name under public/sample/spreads, and the React key. */
  id: string;
  /** Interior page numbers, verso then recto. */
  left: number;
  right: number;
  /** What this pair is for. Shown under it — quietly, in small type. */
  caption: string;
  /** Alt text. Describes the layout, since the photographs are stand-ins. */
  alt: string;
}

// Ordered deliberately, strongest first — the page shows SPREADS[0] large
// and the rest beneath it. The lead was the full-bleed photograph, and it
// undersold the book badly: the stand-in photographs are abstract gradients,
// so at that size the spread reads as a placeholder rather than as a page.
// The list of little things leads instead. It is legible at any size, it is
// the writing rather than the pictures, and the writing is the part nobody
// else is doing.
export const SPREADS: Spread[] = [
  {
    id: "the-little-things",
    left: 14,
    right: 15,
    caption:
      "The list nobody thinks to write down, opposite an ordinary week.",
    alt: "An open book: on the left, a list headed The little things — currently eating, currently saying, bedtime requirement. On the right, four photographs of ordinary days.",
  },
  {
    id: "a-quote-alone",
    left: 4,
    right: 5,
    caption:
      "Something she said, given a page of its own. Nothing is corrected — “byself” is how she says it.",
    alt: "An open book: on the left, a single sentence a two-year-old said, set large with her age beneath it. On the right, a chapter opening titled The year of Bun Bun.",
  },
  {
    id: "photo-and-story",
    left: 2,
    right: 3,
    caption: "A photograph given the whole page, opposite the story it belongs to.",
    alt: "An open book: a full-page photograph on the left, and on the right a smaller photograph above a short piece of writing about watching for the rubbish truck.",
  },
];


/** Where the renderer writes them, and the page reads them from. */
export const spreadSrc = (id: string) => `/sample/spreads/${id}.webp`;

/**
 * What has to be said next to them.
 *
 * The layouts are genuine — rendered by the software that makes the book,
 * from the same volume definition as the press PDF. The photographs are not:
 * they are generated stand-ins, because no real child's imagery is used
 * anywhere in this project. On a page selling a photo book that distinction
 * is not a footnote, so it is kept beside the images rather than in a policy,
 * and a test requires it.
 */
export const SPREADS_DISCLOSURE =
  "The layouts are real — rendered by the same software that makes the " +
  "printed book, down to the paper colour and the position of the page " +
  "numbers. The photographs are stand-ins. No real child's pictures appear " +
  "anywhere on this site, and Florence is invented.";
