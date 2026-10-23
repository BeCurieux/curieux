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
//
// Status (founder, 22 Oct 2026): "on-sale" and "free" are live on Gumroad;
// "off-sale" is in catalog.py but not listed; "unreleased" has a finished
// file but isn't for sale yet. Only on-sale and free items are ever shown to
// customers as something to get.

export type CatalogueStatus = "on-sale" | "free" | "off-sale" | "unreleased";

/** The Income Fit Test on Gumroad (founder, 22 Oct 2026; may move once the shop scripts run). */
export const INCOME_FIT_TEST_URL = "https://herlittleempireco.gumroad.com/l/income-fit-test";

/** The free 5-Question Fit Check on Gumroad (permalink `fit-check`, founder, 22 Oct 2026). */
export const FIT_CHECK_URL = "https://herlittleempireco.gumroad.com/l/fit-check";

export interface CatalogueItem {
  slug: string;
  title: string;
  /** USD; 0 for a free product; null when it has no price yet. */
  priceUsd: number | null;
  status: CatalogueStatus;
  /** Gumroad short link, where known (herlittleempireco.gumroad.com/l/<permalink>). */
  gumroadPermalink?: string;
  gumroadProductIds: string[];
  /** The Empire Studio feature it powers or is planned to become. */
  becomes: string | null;
}

export interface Bundle {
  slug: string;
  title: string;
  priceUsd: number;
  status: Extract<CatalogueStatus, "on-sale">;
  gumroadProductIds: string[];
  contents: string[];
}

const item = (
  slug: string,
  title: string,
  priceUsd: number | null,
  status: CatalogueStatus,
  becomes: string | null,
  gumroadPermalink?: string,
): CatalogueItem => ({
  slug,
  title,
  priceUsd,
  status,
  ...(gumroadPermalink ? { gumroadPermalink } : {}),
  gumroadProductIds: [],
  becomes,
});

/** Everything in catalog.py, which is what The Whole Empire contains. */
const CATALOG_PY: string[] = [];
const sold = (...args: Parameters<typeof item>) => {
  const i = item(...args);
  CATALOG_PY.push(i.slug);
  return i;
};

export const CATALOGUE: CatalogueItem[] = [
  sold(
    "income-fit-test",
    "The Income Fit Test",
    19,
    "on-sale",
    "FIT Finder (built: quiz, report, calculator, 14-day plan)",
    "income-fit-test",
  ),
  sold("video-course", "Video Course", 6, "on-sale", "Guided learning beside the FIT Finder"),
  sold("first-5-customers", "First 5 Customers", 7, "on-sale", "Launch emails method"),
  sold("get-found", "Get Found", 7, "on-sale", "Product listing SEO method"),
  sold("price-it-right", "Price It Right", 5, "on-sale", "Pricing calculator"),
  sold("14-day-tracker", "14-Day Tracker", 4, "on-sale", "FIT Finder 14-day progress"),
  sold("brand-in-a-box", "Brand-in-a-Box", 9, "on-sale", null),
  sold("100-faceless-hooks", "100 Faceless Hooks", 9, "on-sale", "Searchable hook library"),
  sold("comment-to-dm-kit", "Comment-to-DM Kit", 12, "on-sale", "Social launch kit"),
  sold(
    "30-day-faceless-content-plan",
    "30-Day Faceless Content Plan",
    17,
    "on-sale",
    "Social launch kit and editable calendar",
  ),
  sold(
    "little-offer-kit",
    "Your Little Offer Kit",
    19,
    "on-sale",
    "Product listing and homepage copy method",
  ),
  sold(
    "va-starter-kit",
    "VA & Online Business Manager Starter Kit",
    29,
    "on-sale",
    "Launch pathway",
  ),
  sold(
    "etsy-digital-downloads-starter-kit",
    "Etsy Digital Downloads Starter Kit",
    29,
    "on-sale",
    "Etsy Studio (future)",
  ),
  sold(
    "pinterest-manager-starter-kit",
    "Pinterest Manager Starter Kit",
    29,
    "on-sale",
    "Launch pathway",
  ),
  sold("tutor-lesson-starter-kit", "Tutor & Lesson Starter Kit", 29, "on-sale", "Launch pathway"),
  sold("90-day-grow-plan", "The 90-Day Grow Plan", 24, "on-sale", "Post-launch plan"),
  sold("side-income-money-system", "Side Income Money System", 19, "on-sale", "Money calculator"),
  sold("client-paperwork-kit", "Client Paperwork Kit", 19, "off-sale", null),
  sold("ai-business-assistant-pack", "AI Business Assistant Pack", 12, "off-sale", null),
  item(
    "fit-check-freebie",
    "The 5-Question Fit Check",
    0,
    "free",
    "FIT Finder (free top three)",
    "fit-check",
  ),
  item(
    "sell-it-simply-workbook",
    "Sell It Simply",
    null,
    "unreleased",
    "Product listing, homepage and email methods",
  ),
  item(
    "faceless-content-system-workbook",
    "Faceless Content System",
    null,
    "unreleased",
    "Social content method",
  ),
  item(
    "faceless-not-anonymous-workbook",
    "Faceless & Not Anonymous",
    null,
    "unreleased",
    "Trust rules in the social and homepage methods",
  ),
];

export const BUNDLES: Bundle[] = [
  {
    slug: "empire-bundle",
    title: "The Empire Bundle",
    priceUsd: 39,
    status: "on-sale",
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
    status: "on-sale",
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
    status: "on-sale",
    gumroadProductIds: [],
    contents: CATALOG_PY,
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
