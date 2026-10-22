// The Her Little Empire product catalogue, as Empire Studio understands it.
//
// Existing downloads keep working: anyone who bought one on Gumroad keeps
// their file there, and if she signs in to Empire Studio with the same
// email, the purchase shows up in "Your library" — clearly separate from the
// Launch Pack software. Nothing here unpublishes or changes a Gumroad
// listing; see docs/MIGRATION.md.
//
// STATUS: the titles below come from the founder's addendum. The source
// files, versions and Gumroad product ids have not been supplied yet, so
// every entry is `unverified`. Fill in `gumroadProductIds` from the Gumroad
// dashboard (Product → Edit → the id in the URL or API) before relying on
// library matching. content/register.json holds the full mapping.

export interface CatalogueItem {
  slug: string;
  title: string;
  kind: "assessment" | "report" | "system" | "kit" | "micro-tool" | "course" | "library";
  /** What it is, in the founder's words once supplied. Empty until then. */
  description: string;
  gumroadProductIds: string[];
  status: "unverified" | "verified";
  /** The Empire Studio feature it is planned to become (content/register.json). */
  becomes: string | null;
}

export const CATALOGUE: CatalogueItem[] = [
  { slug: "income-fit-test", title: "Income Fit Test", kind: "assessment", description: "", gumroadProductIds: [], status: "unverified", becomes: "FIT Finder questionnaire" },
  { slug: "income-fit-report", title: "Income Fit Report", kind: "report", description: "", gumroadProductIds: [], status: "unverified", becomes: "FIT Finder results" },
  { slug: "business-starter-system", title: "Business Starter System", kind: "system", description: "", gumroadProductIds: [], status: "unverified", becomes: "Shopify launch workflow" },
  { slug: "your-little-offer-kit", title: "Your Little Offer Kit", kind: "kit", description: "", gumroadProductIds: [], status: "unverified", becomes: "Offer-building workflow" },
  { slug: "price-it-right", title: "Price It Right", kind: "kit", description: "", gumroadProductIds: [], status: "unverified", becomes: "Pricing tool" },
  { slug: "first-5-customers", title: "First 5 Customers", kind: "kit", description: "", gumroadProductIds: [], status: "unverified", becomes: "Launch marketing pathway" },
  { slug: "faceless-content-system", title: "Faceless Content System", kind: "system", description: "", gumroadProductIds: [], status: "unverified", becomes: "Content Studio" },
  { slug: "100-faceless-hooks", title: "100 Faceless Hooks", kind: "micro-tool", description: "", gumroadProductIds: [], status: "unverified", becomes: "Searchable hook library" },
  { slug: "30-day-faceless-content-plan", title: "30-Day Faceless Content Plan", kind: "micro-tool", description: "", gumroadProductIds: [], status: "unverified", becomes: "Editable social calendar" },
  { slug: "money-operations-kit", title: "Money & Operations Kit", kind: "kit", description: "", gumroadProductIds: [], status: "unverified", becomes: "Money Calculator" },
  { slug: "side-income-money-system", title: "Side Income Money System", kind: "system", description: "", gumroadProductIds: [], status: "unverified", becomes: "Money Calculator" },
  { slug: "brand-in-a-box", title: "Brand-in-a-Box", kind: "kit", description: "", gumroadProductIds: [], status: "unverified", becomes: "Brand Blueprint generator" },
];

export function catalogueItem(slug: string): CatalogueItem | undefined {
  return CATALOGUE.find((item) => item.slug === slug);
}

/** Which existing product a Gumroad product id is, if any. */
export function librarySlugFor(gumroadProductId: string): string | null {
  return CATALOGUE.find((item) => item.gumroadProductIds.includes(gumroadProductId))?.slug ?? null;
}
