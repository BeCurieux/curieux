// Lists your Gumroad products and suggests which catalogue entry each one is,
// so their ids can be copied into src/content/catalogue.ts.
//
// Run on your own computer, never in a shared terminal or CI log:
//
//   GUMROAD_ACCESS_TOKEN=… npx tsx scripts/gumroad-products.ts
//
// Read-only (GET /v2/products). The token is read from the environment and
// is never printed or written anywhere. Product ids aren't secret.

import { suggestMappings, type GumroadListedProduct } from "../src/lib/billing/gumroad-match";

async function main() {
  const token = process.env.GUMROAD_ACCESS_TOKEN;
  if (!token) {
    console.error(
      "Set GUMROAD_ACCESS_TOKEN in this terminal first (see docs/phase-1/GUMROAD_CONNECTION_CHECKLIST.md).",
    );
    process.exit(1);
  }
  const res = await fetch("https://api.gumroad.com/v2/products", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    console.error(`Gumroad answered ${res.status}. Check the token is current; it wasn't printed.`);
    process.exit(1);
  }
  const body = (await res.json()) as { success?: boolean; products?: GumroadListedProduct[] };
  const suggestions = suggestMappings(body.products ?? []);

  console.log("Gumroad product → suggested catalogue slug (check every line):\n");
  for (const s of suggestions)
    console.log(
      `${s.slug ?? "(no match)"}`.padEnd(38),
      s.gumroadId.padEnd(26),
      `${s.gumroadName} · ${s.price}${s.published === false ? " · unpublished" : ""} · matched by ${s.how}`,
    );

  const bySlug: Record<string, string[]> = {};
  for (const s of suggestions) if (s.slug) (bySlug[s.slug] ??= []).push(s.gumroadId);
  console.log("\nFor src/content/catalogue.ts (gumroadProductIds), after checking:\n");
  console.log(JSON.stringify(bySlug, null, 2));
}

void main();
