/**
 * The kill test, re-pointed at v5 (owner's call, 2026-09-26).
 *
 * Same mechanics, same bar: thirty brands, a shop made from each one's public
 * catalogue, and proceed at five actively wanting it live. What changed is
 * the artefact and who receives it. Each founder-led $1–20M brand gets **two
 * or three campaign POPs**, chosen by `pop suggest` from what its own Genome
 * has depth for, and a note that leads with **the products a keyword
 * collection would have missed**. That is the one claim a founder cannot get
 * from Shopify in five minutes, and the signal worth listening for is "I
 * wouldn't have picked these, and they're right".
 *
 * A brand whose catalogue reads `skip` is not sent anything. A shop with
 * nothing the Genome found is a collection with a nicer header, and sending it
 * would test the wrong thing in the direction that kills the product.
 *
 * Pure functions: which suggestions to send, what to call them, what the note
 * says. `scripts/killtest.ts` does the crawling, spending and publishing.
 */

import { slugify } from "@/lib/publish/slug";
import type { Suggestion } from "@/lib/pop/suggest";

export interface SentPop {
  slug: string;
  url: string;
  sentence: string;
  products: number;
  /** Titles, not handles: this is what the founder reads. */
  genomeOnly: string[];
}

/**
 * The POPs worth sending: Genome-led ones first, at most one per occasion ×
 * audience pair, so a brand does not get two near-identical Father's Day shops.
 */
export function choosePops(suggestions: readonly Suggestion[], perBrand: number): Suggestion[] {
  const led = [...suggestions].sort(
    (a, b) => b.genomeOnly.length / b.handles.length - a.genomeOnly.length / a.handles.length || b.rank - a.rank,
  );
  const seen = new Set<string>();
  const out: Suggestion[] = [];
  for (const s of led) {
    const key = `${s.brief.why.occasionFit[0]}|${s.brief.who.audienceFit[0]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= perBrand) break;
  }
  return out;
}

/** `<brand>-fathers-day-dads-water`, within the slug limit. */
export function popSlug(brandName: string, suggestion: Suggestion): string {
  const s = suggestion.brief;
  const parts = [brandName, s.why.occasionFit[0]?.replace(/_/g, " ") ?? "", s.who.persona.split(" ")[0] ?? "", s.targets.use_context[0]?.split("_")[0] ?? ""];
  // Each part through `slugify` (which also caps at 40), then joined, so the
  // cut below sees the whole thing and can land on a word boundary.
  const full = parts.map((p) => slugify(p)).filter(Boolean).join("-");
  if (full.length <= 40) return full;
  // Cut at a word, not through one: "…-dads", never "…-dads-wate".
  const cut = full.slice(0, 41);
  return cut.slice(0, cut.lastIndexOf("-")).replace(/-+$/g, "");
}

/**
 * The note to send, drafted. Honest by construction, like the v3 message it
 * replaces: nothing is live or synced, and it says so in the first lines.
 */
export function outreachNote(brandName: string, pops: readonly SentPop[]): string {
  const finds = pops.flatMap((p) => p.genomeOnly.slice(0, 3));
  const lines = [
    `# ${brandName}: campaign shops made from your catalogue`,
    "",
    "Draft message, to edit before sending:",
    "",
    "> Hi, I made these from your public product feed. They aren't live, and they don't sync yet. They go live, and stay current, the moment you connect your store:",
    ">",
    ...pops.map((p) => `> - **${p.sentence.replace(/^Make an? /, "").replace(/\.$/, "")}**: ${p.url}`),
    ">",
    ...(finds.length
      ? [
          `> A few of the picks aren't tagged for these occasions anywhere in your store: ${finds.join(", ")}. That's the part I'd love your read on. Would you have picked them?`,
          ">",
        ]
      : []),
    "> Want any of them live for your next campaign?",
    "",
    "## Behind each shop",
    "",
    ...pops.flatMap((p) => [
      `- ${p.url}: ${p.products} products; ${p.genomeOnly.length ? `found by the Genome only: ${p.genomeOnly.join(", ")}` : "every product is one a keyword collection would also reach"}`,
    ]),
    "",
    "Log what happens with `pnpm killtest log <store-url> --stage <stage> --said \"...\"`.",
    "The answer worth writing down verbatim is whether they would have picked the Genome's finds themselves.",
  ];
  return `${lines.join("\n")}\n`;
}
