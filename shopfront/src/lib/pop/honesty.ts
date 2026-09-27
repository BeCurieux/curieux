/**
 * A product's copy may say only what its listing supports.
 *
 * The first real POP ("dads who boat") showed what goes wrong without this.
 * Workshop gloves became "grip for wet lines" and a socket set "covers deck
 * hardware". Neither listing mentions water. The model bent the product
 * towards the brief, which is exactly the claim a sceptical merchant catches,
 * and it goes out under their name.
 *
 * The boundary: **page-level framing may speak to the audience** (a hero that
 * says "for the dad who fixes it dockside" is the campaign talking), but **a
 * product card may not assert a use its listing does not**. So each blurb is
 * checked for the brief's own context words (its use contexts, and the
 * persona's distinctive words) that the listing never uses. A blurb that
 * makes such a claim is removed, not rewritten. Blurbs are optional on the
 * page, and a blank line is honest where a guessed one is not.
 */

import type { IngestedProduct } from "@/lib/ingest/types";
import type { ShopConfig } from "@/lib/schema";
import { targetsOf, type PopBrief } from "./brief";

/** Words that claim a setting of use. Stems matched at word starts; a trailing `$` means the whole word only ("sea" must not catch "season"). */
const CONTEXT_TERMS: Record<string, string[]> = {
  water_coastal: ["boat", "sail", "dock", "deck", "marine", "beach", "surf", "swim", "fish", "coast", "wet$", "yacht", "kayak", "paddl", "harbo", "shore", "seaside", "ocean", "sea$", "seas$", "salt$", "saltwater", "tide$", "tides$", "mooring", "lines$"],
  outdoor: ["hike", "hiking", "camp", "trail", "garden", "backyard", "outdoor", "bushwalk", "picnic", "wilderness"],
  travel: ["travel", "trip", "flight", "suitcase", "carry-on", "packable", "luggage", "jet lag"],
  fitness: ["gym", "workout", "training", "running", "yoga", "fitness", "sweat"],
  work: ["office", "desk", "commut", "workshop", "jobsite", "job site"],
  home: ["kitchen", "living room", "bedroom", "sofa", "couch"],
  social_evening: ["party", "parties", "dinner", "cocktail", "evening", "night out"],
  personal_care: ["skin", "groom", "shav", "bath", "spa$"],
};

/** Words in a persona that name who, not what for. Never checked. */
const WHO_WORDS = new Set([
  "dad", "dads", "father", "fathers", "mum", "mums", "mom", "moms", "mother", "mothers", "him", "her", "them", "men", "women",
  "kids", "children", "people", "folks", "those", "who", "love", "loves", "like", "likes", "want", "wants", "need", "needs",
  "into", "with", "their", "the", "and", "for", "gift", "gifts", "someone", "anyone", "friends", "family", "partner", "partners",
]);

function termsFor(brief: PopBrief): string[] {
  const terms = new Set<string>();
  for (const ctx of targetsOf(brief).get("use_context") ?? []) for (const t of CONTEXT_TERMS[ctx] ?? []) terms.add(t);
  for (const word of brief.who.persona.toLowerCase().match(/[a-z]+/g) ?? []) {
    if (word.length >= 4 && !WHO_WORDS.has(word)) terms.add(word.replace(/(ing|ers|er|s)$/, ""));
  }
  return [...terms].filter((t) => t.length >= 3);
}

const mentions = (text: string, term: string) => {
  const whole = term.endsWith("$");
  const stem = (whole ? term.slice(0, -1) : term).replace(/[-\s]/g, "[-\\s]?");
  return new RegExp(`\\b${stem}${whole ? "\\b" : ""}`, "i").test(text);
};

export function listingText(product: IngestedProduct): string {
  return [product.title, product.description, product.productType ?? "", product.tags.join(" "), ...product.variants.flatMap((v) => v.options)].join(" \n ");
}

export interface HonestyResult {
  config: ShopConfig;
  repairs: string[];
}

/** Remove any product blurb that claims a brief context its listing does not state. */
export function enforceListingTruth(config: ShopConfig, brief: PopBrief, products: ReadonlyMap<string, IngestedProduct>): HonestyResult {
  const terms = termsFor(brief);
  const repairs: string[] = [];
  if (terms.length === 0) return { config, repairs };

  const clean = <R extends { handle: string; blurb?: string | undefined }>(ref: R, where: string): R => {
    if (!ref.blurb) return ref;
    const product = products.get(ref.handle);
    const listing = product ? listingText(product) : "";
    const unsupported = terms.filter((t) => mentions(ref.blurb!, t) && !mentions(listing, t));
    if (!unsupported.length) return ref;
    const said = unsupported.map((t) => (t.endsWith("$") ? `"${t.slice(0, -1)}"` : `"${t}…"`)).join(", ");
    repairs.push(`${where}: removed the blurb for "${ref.handle}" ("${ref.blurb}"); its listing never says ${said}.`);
    const { blurb: _b, ...rest } = ref;
    return rest as R;
  };

  const blocks = config.blocks.map(({ id, block }) => {
    switch (block.type) {
      case "productGrid":
      case "drop":
        return { id, block: { ...block, products: block.products.map((p) => clean(p, id)) } };
      case "routine":
        return { id, block: { ...block, steps: block.steps.map((s) => ({ ...s, product: clean(s.product, id) })) } };
      default:
        return { id, block };
    }
  }) as ShopConfig["blocks"];
  return { config: { ...config, blocks }, repairs };
}
