// The Her Little Empire product catalogue, from the founder's catalog.py
// ("single source of truth: products, files, prices, bundles"), as of
// 21–22 October 2026. Prices are USD and are the live Gumroad prices —
// Empire Studio displays them, never changes them.
//
// Existing downloads keep working: anyone who bought one on Gumroad keeps
// it there, and if she signs in with the same email it appears in "Your
// library" — separate from the Launch Pack software. Buying a bundle counts
// as owning everything in it. Nothing here unpublishes or changes a Gumroad
// listing; see docs/MIGRATION.md.
//
// `gumroadProductIds` must be filled from the Gumroad dashboard before
// library matching works (they aren't in catalog.py).

export interface CatalogueItem {
  slug: string;
  title: string;
  priceUsd: number;
  /** Live on Gumroad per catalog.py's ON_GUMROAD (21 Oct 2026). */
  onGumroad: boolean;
  gumroadProductIds: string[];
  /** The Empire Studio feature it powers or is planned to become. */
  becomes: string | null;
}

export interface Bundle {
  slug: string;
  title: string;
  priceUsd: number;
  onGumroad: boolean;
  gumroadProductIds: string[];
  contents: string[];
}

const item = (
  slug: string,
  title: string,
  priceUsd: number,
  onGumroad: boolean,
  becomes: string | null,
): CatalogueItem => ({
  slug,
  title,
  priceUsd,
  onGumroad,
  gumroadProductIds: [],
  becomes,
});

export const CATALOGUE: CatalogueItem[] = [
  item(
    "income-fit-test",
    "The Income Fit Test",
    19,
    true,
    "FIT Finder (built: quiz, report, calculator, 14-day plan)",
  ),
  item("video-course", "Video Course", 6, true, "Guided learning beside the FIT Finder"),
  item("first-5-customers", "First 5 Customers", 7, true, "Launch emails method"),
  item("get-found", "Get Found", 7, true, "Product listing SEO method"),
  item("price-it-right", "Price It Right", 5, true, "Pricing calculator"),
  item("14-day-tracker", "14-Day Tracker", 4, true, "FIT Finder 14-day progress"),
  item("brand-in-a-box", "Brand-in-a-Box", 9, true, "Brand Blueprint method"),
  item("100-faceless-hooks", "100 Faceless Hooks", 9, true, "Searchable hook library"),
  item("comment-to-dm-kit", "Comment-to-DM Kit", 12, true, "Social launch kit"),
  item(
    "30-day-faceless-content-plan",
    "30-Day Faceless Content Plan",
    17,
    true,
    "Social launch kit and editable calendar",
  ),
  item(
    "little-offer-kit",
    "Your Little Offer Kit",
    19,
    true,
    "Product listing and homepage copy method",
  ),
  item("va-starter-kit", "VA & Online Business Manager Starter Kit", 29, true, "Launch pathway"),
  item(
    "etsy-digital-downloads-starter-kit",
    "Etsy Digital Downloads Starter Kit",
    29,
    true,
    "Etsy Studio (future)",
  ),
  item(
    "pinterest-manager-starter-kit",
    "Pinterest Manager Starter Kit",
    29,
    true,
    "Launch pathway",
  ),
  item("tutor-lesson-starter-kit", "Tutor & Lesson Starter Kit", 29, true, "Launch pathway"),
  item("90-day-grow-plan", "The 90-Day Grow Plan", 24, true, "Post-launch plan"),
  item("side-income-money-system", "Side Income Money System", 19, true, "Money calculator"),
  item("client-paperwork-kit", "Client Paperwork Kit", 19, false, null),
  item("ai-business-assistant-pack", "AI Business Assistant Pack", 12, false, null),
];

export const BUNDLES: Bundle[] = [
  {
    slug: "empire-bundle",
    title: "The Empire Bundle",
    priceUsd: 39,
    onGumroad: true,
    gumroadProductIds: [],
    contents: [
      "income-fit-test",
      "video-course",
      "first-5-customers",
      "get-found",
      "price-it-right",
      "14-day-tracker",
      "brand-in-a-box",
    ],
  },
  {
    slug: "faceless-content-bundle",
    title: "The Faceless Content Bundle",
    priceUsd: 29,
    onGumroad: true,
    gumroadProductIds: [],
    contents: [
      "100-faceless-hooks",
      "30-day-faceless-content-plan",
      "comment-to-dm-kit",
      "get-found",
    ],
  },
  {
    slug: "the-whole-empire",
    title: "The Whole Empire",
    priceUsd: 99,
    onGumroad: true,
    gumroadProductIds: [],
    contents: CATALOGUE.map((i) => i.slug),
  },
];

export function catalogueItem(slug: string): CatalogueItem | undefined {
  return CATALOGUE.find((i) => i.slug === slug);
}

/** Which product or bundle a Gumroad product id is, if any. */
export function librarySlugFor(gumroadProductId: string): string | null {
  return (
    [...CATALOGUE, ...BUNDLES].find((i) => i.gumroadProductIds.includes(gumroadProductId))?.slug ??
    null
  );
}

/** Owned slugs (products and bundles) → every product she owns. */
export function expandLibrary(slugs: string[]): string[] {
  const out = new Set<string>();
  for (const slug of slugs) {
    const bundle = BUNDLES.find((b) => b.slug === slug);
    if (bundle) bundle.contents.forEach((c) => out.add(c));
    else out.add(slug);
  }
  return CATALOGUE.map((i) => i.slug).filter((s) => out.has(s));
}
