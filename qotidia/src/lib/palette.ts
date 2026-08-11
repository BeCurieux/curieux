// The site palette, as data.
//
// It lived in tailwind.config.ts with a comment claiming every pair had been
// checked with the project's own contrastRatio(). Nothing checked it. That
// is the shape of claim this project keeps finding: true when written, and
// nothing stopping the next person making it false.
//
// So the values live here, Tailwind reads them, and a test asserts the pairs
// that matter. Change a colour and the test tells you what you broke.
//
// The direction, after looking at how independent publishers set a page: the
// site is cream and ink, and the colour comes from the books. Nineteen fixed
// annual colours already exist in lib/book/colours.ts — that is the brand's
// real palette, and the website's job is to be the paper they sit on rather
// than to compete with them. So there is no chart of brand colours here.
// There is a ground, a type colour, one accent, and the surfaces needed to
// separate a band from the band above it.

export const PALETTE = {
  /** Warm near-black. Type, and the ground of the two dark bands. */
  ink: "#24211D",
  /** The ground almost everything sits on — the colour of the stock. */
  paper: "#F6F2EA",
  /**
   * A recessed band, half a shade deeper than the paper.
   *
   * Deeper rather than lighter, which is a change. The old ground was dark
   * enough that a raised cream card could lift off it; against a paper this
   * light the ceiling is white, worth about 1.13:1, and a surface you cannot
   * see is not a surface. Going down instead gives a band a reader can
   * actually perceive without a border drawn round it.
   */
  card: "#EAE3D6",
  /** The one genuinely raised surface. Form fields, and very little else. */
  white: "#FFFDFA",
  /**
   * Oxblood. The one proprietary colour.
   *
   * Terracotta before this, and the change is not only a change of hue. The
   * old accent could not be read as type on cream — it reached about 3.7:1,
   * so the palette carried a second, deeper tone purely to make links
   * legible, and a test asserted that the accent must never be set as type.
   *
   * That test was quietly wrong about the codebase: `text-clay` appears
   * twenty-two times, on every micro-label on every page. Oxblood is dark
   * enough that the rule can be inverted rather than patched — the accent is
   * now legible as type everywhere, at 8.86:1 on paper, and the test asserts
   * that instead.
   *
   * It also has to survive the company outgrowing young families. Terracotta
   * is a nursery colour in a way this is not.
   */
  clay: "#6E2F36",
  /** The lighter, warmer oxblood. Links, so they lift off the labels. */
  ochre: "#8C4D54",
  /** Headings on a coloured ground. */
  slate: "#4A4139",
  /**
   * Secondary type. Most of the body copy on this site.
   *
   * The brief asked for #8A8278. That is 3.39:1 on this paper and 2.96:1 on
   * the recessed band — it fails the pair it is used for most, which is not
   * a judgement call. Deepened to the nearest tone that holds on *both*
   * grounds; it is the same taupe, two steps down.
   */
  stone: "#685F56",
  /** Hairlines. Visible without shouting. */
  rule: "#DED3C2",
} as const;

export interface Contract {
  what: string;
  fg: string;
  bg: string;
  /** The floor this pair must clear. */
  min: number;
  /** Why this number and not another. */
  because: string;
}

/**
 * What each pair has to survive.
 *
 * Two kinds of minimum. Type against its ground is held to WCAG AA — 4.5 for
 * body, 3.0 for type above about 24px. Surfaces against each other are held
 * to something much smaller, because the job there is only to be *visible*:
 * below about 1.08 a band and its neighbour read as one flat field, which is
 * how the first version of this site ended up looking like a document.
 */
export const CONTRACTS: Contract[] = [
  {
    what: "body type on paper",
    fg: PALETTE.ink, bg: PALETTE.paper, min: 4.5,
    because: "The main reading pair. Everything else is negotiable; this is not.",
  },
  {
    what: "secondary type on paper",
    fg: PALETTE.stone, bg: PALETTE.paper, min: 4.5,
    because: "Used for most body copy on this site, so it is held to body contrast.",
  },
  {
    what: "links on paper",
    fg: PALETTE.ochre, bg: PALETTE.paper, min: 4.5,
    because:
      "The accent used to carry every link at 2.08:1 — the interactive text " +
      "was the least legible text on the site.",
  },
  {
    what: "micro-labels on paper",
    fg: PALETTE.clay, bg: PALETTE.paper, min: 4.5,
    because:
      "`text-clay` sets every uppercase label in the product, twenty-two of " +
      "them, at around 12px. Under terracotta that pair was 3.7:1 and the " +
      "palette's answer was a test asserting the accent must never be type — " +
      "a rule the codebase had already broken everywhere. Oxblood makes it " +
      "legible, so this is a real contract instead.",
  },
  {
    what: "micro-labels on the recessed band",
    fg: PALETTE.clay, bg: PALETTE.card, min: 4.5,
    because: "The same labels appear inside panels. Both grounds have to hold.",
  },
  {
    what: "secondary type on the recessed band",
    fg: PALETTE.stone, bg: PALETTE.card, min: 4.5,
    because: "Same copy, a different ground. Both have to hold.",
  },
  {
    what: "links on the recessed band",
    fg: PALETTE.ochre, bg: PALETTE.card, min: 4.5,
    because: "As above.",
  },
  {
    what: "type on ink",
    fg: PALETTE.paper, bg: PALETTE.ink, min: 4.5,
    because: "The dark bands carry real reading, not just a headline.",
  },
  {
    what: "button label on clay",
    fg: PALETTE.white, bg: PALETTE.clay, min: 4.5,
    because:
      "Must be white and not paper. Paper on clay reaches about 4.1 and " +
      "fails, which is not visible to anyone choosing by eye.",
  },
  {
    what: "large headings on paper",
    fg: PALETTE.slate, bg: PALETTE.paper, min: 3,
    because: "AA for large text. Only ever used above about 24px.",
  },
  {
    what: "type on the oxblood band",
    fg: PALETTE.paper, bg: PALETTE.ochre, min: 4.5,
    because:
      "The 'not a photobook' section is a full ground of the accent carrying " +
      "real reading, not just a headline.",
  },
  {
    what: "the recessed band against the paper",
    fg: PALETTE.card, bg: PALETTE.paper, min: 1.08,
    because:
      "A change of ground is how this page gets a horizon instead of a stack " +
      "of ruled boxes. Below this it is one flat field.",
  },
  {
    what: "hairlines against the paper",
    fg: PALETTE.rule, bg: PALETTE.paper, min: 1.2,
    because: "A rule at 1.09:1 is a rule nobody can see.",
  },
];
