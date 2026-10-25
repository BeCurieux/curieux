import { BUNDLES, CATALOGUE } from "@/content/catalogue";

// Suggests which catalogue entry each Gumroad product is, from the seller's
// own product list (GET /v2/products), so product ids can be copied into
// src/content/catalogue.ts without retyping them. Suggestions only: a person
// checks each one before it's pasted. Used by scripts/gumroad-products.ts.

export interface GumroadListedProduct {
  id: string;
  name: string;
  short_url?: string;
  custom_permalink?: string | null;
  formatted_price?: string;
  published?: boolean;
}

export interface Suggestion {
  gumroadId: string;
  gumroadName: string;
  price: string;
  published: boolean | null;
  slug: string | null;
  how: "permalink" | "title" | "none";
}

const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|your|a|kit)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function suggestMappings(products: GumroadListedProduct[]): Suggestion[] {
  const entries = [...CATALOGUE, ...BUNDLES];
  return products.map((p) => {
    const permalink =
      p.custom_permalink ?? p.short_url?.split("/l/")[1]?.split(/[?#]/)[0] ?? undefined;
    const byPermalink = permalink
      ? CATALOGUE.find((i) => i.gumroadPermalink === permalink)
      : undefined;
    const byTitle = byPermalink ? undefined : entries.find((i) => words(i.title) === words(p.name));
    const match = byPermalink ?? byTitle;
    return {
      gumroadId: p.id,
      gumroadName: p.name,
      price: p.formatted_price ?? "",
      published: typeof p.published === "boolean" ? p.published : null,
      slug: match?.slug ?? null,
      how: byPermalink ? "permalink" : byTitle ? "title" : "none",
    };
  });
}

/** Problems that would make purchase matching ambiguous. Empty means fine. */
export function catalogueIdProblems(): string[] {
  const seen = new Map<string, string>();
  const problems: string[] = [];
  for (const item of [...CATALOGUE, ...BUNDLES]) {
    for (const id of item.gumroadProductIds) {
      if (!/^[A-Za-z0-9_=-]{6,}$/.test(id)) problems.push(`${item.slug}: "${id}" isn't an id`);
      const other = seen.get(id);
      if (other) problems.push(`${id} is listed under both ${other} and ${item.slug}`);
      seen.set(id, item.slug);
    }
  }
  return problems;
}
