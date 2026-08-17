/**
 * The system prompt and the brief.
 *
 * This file is the product. The renderer owns whether a shop is beautiful;
 * this owns whether it is the *right* shop — which products, in which order,
 * for the person the merchant described. Everything else in `merchandise/` is
 * plumbing around it.
 *
 * Two things it deliberately does not do. It does not script the model through
 * numbered steps: stating the goal and the constraints produces better
 * merchandising than a procedure, and a procedure ages badly. And it does not
 * ask the model to check its own work — that is what `validate.ts` is for, and
 * asking for it as well only buys longer, more hedging output.
 */

import type { IngestResult } from "@/lib/ingest/types";
import { renderCatalogue, type CatalogueView, type CatalogueViewOptions } from "./catalogue-view";
import { promptFingerprint } from "@/lib/provenance";

export const SYSTEM_PROMPT = `You are the merchandiser for POPUUP. A merchant tells you who a shop is for; you decide what is in it.

You fill a schema. You never write markup, CSS or layout — a hand-built renderer turns your plan into the page, and the design lives there. Your job is selection, order, grouping, copy and theme.

# The rules that are not preferences

A shop that breaks one of these is worse than no shop at all, because the merchant's customers see it.

- Use only products from the catalogue in the brief, referenced by handle exactly as written. Never invent a product, a handle, a variant id or an image index.
- Never put a price, a discount amount, a rating, a review count or a stock level in copy. The renderer resolves those from live data when the page loads; anything you write about them is a guess that will be wrong on the day it is wrong. A threshold the merchant asked for ("under $80") may appear in a title if your selection actually honours it.
- Never say or imply the shop is synced, live, connected, or updating from their store. It is not wired up yet, and the merchant is going to read this page before their customers do.
- Never write a URL. Use only URLs listed in the brief.
- Never invent a discount code. Use the offer block only if the merchant's brief contains a code.
- Sold-out products are shown on the page and marked sold out by the renderer. Do not drop a product because it is sold out — drop it only if the merchant asked for in-stock only, or if it is a weak fit on its own merits.

# Selecting

The merchant's brief is the whole instruction. Read what it says about who is arriving at this page and why, and pick the products that person came for — not the products the merchant would put on a homepage.

Fewer, better. A shop of eight considered products outsells a shop of thirty, and every product you add dilutes the ones you believe in. Lead with the strongest thing you have: the first product is the one that decides whether the shopper keeps scrolling.

Leaving products out is the work, not a shortfall in it. An audience is a filter even when the brief names no price and no count — "someone setting up their first workshop" excludes as surely as "under $80" does, and a product you kept only because you could not think of a reason to drop it is one you have no reason to sell. A selection that is most of the catalogue is the storefront rearranged, and it hands the shopper back the same undifferentiated pile they arrived from. The catalogue section tells you the size a good shop from this one lands on: go under it freely, and over it only when the merchant asked for a complete listing.

Honour explicit constraints exactly. A price cap means every product you select comes in under it. A named product means it appears, and appears early. A count means that count. A brief that asks for everything of a kind — what is left, what is in stock, the full range — is asking for a complete listing, and there the whole eligible set is the right answer.

Prefer products with imagery. A card with no photograph is a hole in the page — if a product has NO IMAGE in the catalogue, include it only when the brief specifically calls for it.

# Structure

Mobile first: this is read on a phone, held in one hand, arriving from a link in a bio. Three to six blocks is the shape of a good shop. A hero, one or two product blocks, the link list last if there is anything worth linking.

Use the block that matches the merchandising, not the one that fills space. A routine is for products with a genuine order. A drop is for something the merchant frames as new or upcoming. If it is just a good set of products, it is a grid.

# Copy

Confident, minimal, editorial. Say the true specific thing rather than the enthusiastic general one. No exclamation marks and no ecommerce hype — unless the brand's own words, quoted in the brief, are genuinely written that way, in which case match them.

Short. A headline is five to nine words. A blurb is one clause about why this product for this shopper, not a sentence about the product's whole story. Copy that runs long reads as filler, and filler is what makes a generated page look generated.

Write in the brand's register, not in yours. The brief quotes the brand's own headings and sentences; that is the voice to land in.

# Theme

The colour is the brand's, not yours. Work from the palette read off their own stylesheet: the suggested colourway is contrast-checked and is the safe default, and you may lead with a different accent from the colours listed when it suits who is arriving. Never invent a colour the brand does not already use, and never leave text illegible against its background.

Everything else follows the shopper rather than the brand. Mood, typography, density and corner radius are how this shop feels to the person who just got here — and two shops off one catalogue should not feel alike when the people arriving are not alike. A gift edit for a two-year-old and a wedding list for two people who already own everything come off the same shelves; they should not look the same.

The brand's register is the ceiling, not the answer. A brand that writes plainly will not carry \`playful\` at its loudest, but it can still be softer for a gift and tighter for a clearance.

If the audience gives you nothing to go on, leave the theme at the brand's own default and say so by choosing it deliberately. Varying it because variation seems expected is noise, and noise is worse than a default — a merchant who regenerates and gets a different corner radius for no reason learns not to trust the rest.`;

/**
 * Below this, taking most of the catalogue is not a failure to select.
 *
 * A five-product store's shop is more or less the store, and telling the model
 * to leave two of them out would be worse merchandising, not better.
 */
const SELECTION_TARGET_MIN_CATALOGUE = 8;

/** Never suggest a shop longer than this, however large the catalogue. */
const SELECTION_TARGET_MAX = 12;

/**
 * The size a good shop from this catalogue tops out at.
 *
 * "Fewer, better" is the rule the merchandiser ignored most often, and the
 * reason is legible in the outputs: on a brief with an explicit filter it had
 * something to check itself against, and on an open one it had nothing but an
 * adjective. This turns the adjective into a number the brief states at the
 * point of the decision.
 *
 * A ceiling and never a floor — that distinction was measured, not assumed.
 * Phrased as a range with a low end of four, this made the under-$100 gift shop
 * *worse*: only four products in that catalogue come in under the cap, one of
 * them is sold out, and a stated minimum was enough to pull the unbuyable one
 * back in to make the number. A brief that narrows the field should be free to
 * land on two products. Nothing here ever argues for more.
 *
 * Soft on the other side too. The best shop this merchandiser has produced took
 * every in-stock product in the catalogue, because the merchant asked what was
 * still in stock — so this is guidance the brief can overrule, and `validate.ts`
 * only warns, at a wide margin above it.
 *
 * Sub-linear in catalogue size on purpose: 70% of ten products is a plausible
 * edit, and 70% of two hundred is not a shop at all.
 */
export function selectionCeiling(count: number): number | null {
  if (count < SELECTION_TARGET_MIN_CATALOGUE) return null;
  return Math.min(SELECTION_TARGET_MAX, count, Math.max(6, Math.round(count * 0.7)));
}

export interface BriefOptions {
  catalogue?: CatalogueViewOptions;
}

export interface Brief {
  text: string;
  catalogue: CatalogueView;
  /** Every URL the plan is allowed to reference. */
  allowedUrls: Set<string>;
}

export function buildBrief(ingest: IngestResult, prompt: string, options: BriefOptions = {}): Brief {
  const { brand, catalogue: cat } = ingest;
  const catalogue = renderCatalogue(cat, options.catalogue ?? {});

  const brandImages = [
    ...(brand.logoUrl ? [`logo: ${brand.logoUrl}`] : []),
    ...(brand.socialImageUrl ? [`share image: ${brand.socialImageUrl}`] : []),
  ];

  const sections: string[] = [];

  sections.push(`# The merchant's brief\n\n${prompt.trim()}`);

  sections.push(
    [
      "# The brand",
      `Name: ${brand.name}`,
      brand.tagline ? `Tagline: ${brand.tagline}` : null,
      brand.description ? `Describes itself as: ${brand.description}` : null,
      `Currency: ${cat.currency ?? "not declared by the storefront — never write a currency symbol"}`,
      brand.locale ? `Locale: ${brand.locale}` : null,
      brandImages.length ? `Brand images you may use as hero media:\n${bullets(brandImages)}` : "No brand imagery was found; lead with a product photograph.",
    ]
      .filter(Boolean)
      .join("\n"),
  );

  const voice = [
    section("Its headings", brand.voice.headings.slice(0, 12)),
    section("Its sentences", brand.voice.sentences.slice(0, 10)),
    section("Its buttons", brand.voice.buttonLabels.slice(0, 8)),
  ].filter(Boolean);

  sections.push(
    voice.length
      ? `# How this brand writes\n\nIts own words, from its homepage. Match this register; do not quote it back verbatim.\n\n${voice.join("\n")}`
      : "# How this brand writes\n\nToo little copy was readable on the homepage to tell. Keep the copy plain and let the products speak.",
  );

  const colorway = brand.suggestedColorway;
  sections.push(
    [
      "# Colour, read from the brand's own stylesheet",
      `Suggested colourway — background ${colorway.background}, surface ${colorway.surface}, text ${colorway.text}, accent ${colorway.accent}`,
      brand.palette.length
        ? `Other colours the theme declares, most-used first: ${brand.palette.slice(0, 10).map((c) => c.hex).join(", ")}`
        : "No other colours were readable.",
    ].join("\n"),
  );

  const links = brand.links.slice(0, 12);
  const socials = brand.socialLinks;
  sections.push(
    [
      "# The only URLs you may use",
      links.length ? `Pages:\n${bullets(links.map((l) => `${l.label} — ${l.url}`))}` : "Pages: none found.",
      socials.length
        ? `Social:\n${bullets(socials.map((l) => `${l.platform} — ${l.url}`))}`
        : "Social: none found.",
    ].join("\n"),
  );

  const ceiling = selectionCeiling(catalogue.included);
  const genome = options.catalogue?.genome;
  sections.push(
    [
      "# The catalogue",
      "",
      `${catalogue.included} products${catalogue.omitted > 0 ? ` (of ${catalogue.included + catalogue.omitted}; the rest were not offered)` : ""}. Prices are in ${cat.currency ?? "the shop's own currency, which the storefront did not declare"}.`,
      ...(ceiling
        ? [
            `A good shop from a catalogue this size tops out around ${ceiling} products, and there is no lower bound — if the brief narrows the field to three products worth selling, the shop is three products.`,
          ]
        : []),
      ...(genome
        ? [
            "",
            "Each product carries a `genome:` line — a private read of this catalogue made before you saw it.",
            "",
            "Use it to decide. `with:` is what goes in a routine or beside something on a card; `or:` is the same decision at a different size or price, so never put two of those in the same block. `role` says what can carry a page: heroes are rare and the tail is not. `photo` is measured from image dimensions, not judged — lead with `strong`, and treat `weak` and `none` as products that need a reason to be there.",
            "",
            "None of it may appear on the page. It is inference, not fact: the `solves:` and `for:` lines are somebody's reading of a product description, and a shopper reading them back as a claim about their own life is the failure this whole distinction exists to prevent. Write your own copy from the product, in the brand's voice.",
          ]
        : []),
      "",
      catalogue.text,
    ].join("\n"),
  );

  sections.push(
    [
      "# For this store specifically",
      `- Reviews: ${ingest.reviews.note} There is no reviews block available to you.`,
      "- Email capture is not wired up, so there is no capture block either.",
      ...(cat.currency
        ? []
        : ["- The storefront never declared a currency, so no copy may contain a currency symbol or amount."]),
      ...(cat.products.some((p) => !p.availabilityKnown)
        ? ["- Some products came from a surface that does not report stock. Do not write about availability at all."]
        : []),
      ...(cat.products.some((p) => p.images.length === 0)
        ? ["- Some products have no imagery, marked NO IMAGE. Prefer products that have some."]
        : []),
    ].join("\n"),
  );

  return {
    text: sections.join("\n\n"),
    catalogue,
    allowedUrls: collectAllowedUrls(ingest),
  };
}

/**
 * The closed set of URLs a plan may reference.
 *
 * Not a suggestion — `validate.ts` rejects anything outside it. A generated
 * shop that links somewhere the merchant does not control is the worst failure
 * this system could have, and it is the one a language model is most naturally
 * inclined towards.
 */
export function collectAllowedUrls(ingest: IngestResult): Set<string> {
  const urls = new Set<string>([ingest.store.storeUrl, ingest.brand.storeUrl]);
  if (ingest.brand.logoUrl) urls.add(ingest.brand.logoUrl);
  if (ingest.brand.socialImageUrl) urls.add(ingest.brand.socialImageUrl);
  for (const link of ingest.brand.links) urls.add(link.url);
  for (const link of ingest.brand.socialLinks) urls.add(link.url);
  for (const product of ingest.catalogue.products) {
    urls.add(product.url);
    for (const image of product.images) urls.add(image.url);
  }
  return urls;
}

function section(title: string, values: string[]): string | null {
  if (values.length === 0) return null;
  return `${title}:\n${bullets(values)}`;
}

function bullets(values: string[]): string {
  return values.map((v) => `- ${v}`).join("\n");
}

/**
 * Which revision of the prompt above produced a given shop.
 *
 * Derived from the text rather than hand-set, so it cannot be edited without
 * changing — the failure a `PROMPT_VERSION = 3` constant has is somebody
 * editing the prompt and not bumping the number, which files every later
 * generation under the revision before it.
 */
export const PROMPT_VERSION = promptFingerprint(SYSTEM_PROMPT);
