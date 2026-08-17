/**
 * Everything the schema cannot catch.
 *
 * zod proves the plan is the right *shape*. It cannot prove the handles exist,
 * that the image index is in range, that the link goes somewhere the merchant
 * owns, or that the copy isn't claiming a sync that isn't wired. Those are the
 * failures that actually hurt: a shop that validates perfectly and sells a
 * product nobody stocks, at a price nobody charges, over a link to nowhere.
 *
 * Every error here is written to be read by the model — it goes straight back
 * as the retry turn, so it names the field, says what was wrong, and says what
 * to do instead. Warnings are for the human and never trigger a retry.
 */

import { BANNED_CLAIMS, unqualifiedAmounts } from "@/lib/claims";
import { contrastRatio, parseColour } from "@/lib/ingest/colour";
import type { IngestResult } from "@/lib/ingest/types";
import { SPRINT_1_BLOCK_TYPES, type MerchandisingPlan, type PlannedBlock } from "./plan";
import type { ProductRef } from "@/lib/schema";
import type { z } from "zod";

type Ref = z.infer<typeof ProductRef>;

export interface PlanValidationInput {
  plan: MerchandisingPlan;
  ingest: IngestResult;
  /** The merchant's own words. The only source of offer codes and launch dates. */
  prompt: string;
  allowedUrls: Set<string>;
}

export interface PlanValidation {
  errors: string[];
  warnings: string[];
}

/**
 * Claims we can never substantiate from a public-storefront ingest.
 *
 * The sync group is the one the brief names directly: nothing on the page may
 * claim liveness that isn't wired for that store. The other two are the same
 * failure wearing different clothes — a review count nobody read, a stock
 * level nobody checked.
 */


export function validatePlan(input: PlanValidationInput): PlanValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { plan, ingest, prompt, allowedUrls } = input;

  const byHandle = new Map(ingest.catalogue.products.map((p) => [p.handle, p]));

  checkBlockShape(plan, errors, warnings);
  checkTheme(plan, errors);

  const selected = new Set<string>();

  for (const [index, entry] of plan.blocks.entries()) {
    const where = `blocks[${index}] (id "${entry.id}")`;
    const block = entry.block;

    if (!(SPRINT_1_BLOCK_TYPES as readonly string[]).includes(block.type)) {
      errors.push(`${where}: block type "${block.type}" is not available in this version. Use one of: ${SPRINT_1_BLOCK_TYPES.join(", ")}.`);
      continue;
    }

    for (const { ref, path } of refsOf(block, where)) {
      checkRef(ref, path, byHandle, errors);
      selected.add(ref.handle);
    }

    checkBlockSpecifics({ block, where, prompt, byHandle, allowedUrls, errors, warnings });
    checkCopy(block, where, byHandle, errors);
  }

  checkStock(plan, ingest, selected, prompt, warnings);
  checkSelection(ingest, selected, prompt, warnings);
  checkImagery(plan, byHandle, warnings);

  return { errors, warnings };
}

// ------------------------------------------------------------------ structure

function checkBlockShape(plan: MerchandisingPlan, errors: string[], warnings: string[]): void {
  const ids = new Set<string>();
  for (const [index, entry] of plan.blocks.entries()) {
    if (ids.has(entry.id)) {
      errors.push(`blocks[${index}]: duplicate block id "${entry.id}". Word-edits target blocks by id, so every id must be unique.`);
    }
    ids.add(entry.id);
  }

  const heroes = plan.blocks.filter((b) => b.block.type === "hero");
  if (heroes.length > 1) errors.push(`This plan has ${heroes.length} hero blocks. Use exactly one, first.`);
  if (heroes.length === 1 && plan.blocks[0]?.block.type !== "hero") {
    warnings.push("The hero is not the first block; the renderer will still put it where the plan says.");
  }

  const linkLists = plan.blocks.filter((b) => b.block.type === "linkList");
  if (linkLists.length > 1) errors.push(`This plan has ${linkLists.length} linkList blocks. Use at most one, last.`);

  const targets = new Set(plan.blocks.map((b) => b.id));
  for (const [index, entry] of plan.blocks.entries()) {
    if (entry.block.type !== "hero") continue;
    const target = entry.block.cta?.targetBlockId;
    if (target && !targets.has(target)) {
      errors.push(`blocks[${index}].block.cta.targetBlockId is "${target}", which is not the id of any block in this plan.`);
    }
  }
}

function checkTheme(plan: MerchandisingPlan, errors: string[]): void {
  const { colorway } = plan.theme;
  const parsed = {
    background: parseColour(colorway.background),
    surface: parseColour(colorway.surface),
    text: parseColour(colorway.text),
    accent: parseColour(colorway.accent),
  };

  for (const [role, rgb] of Object.entries(parsed)) {
    if (!rgb) {
      errors.push(`theme.colorway.${role} is "${colorway[role as keyof typeof colorway]}", which is not a CSS colour. Use a hex value like #1a1a1a.`);
    }
  }
  if (!parsed.background) return;

  // A shop nobody can read is worse than a shop that ignored the brand's grey.
  if (parsed.text) {
    const ratio = contrastRatio(parsed.text, parsed.background);
    if (ratio < 4.5) {
      errors.push(
        `theme.colorway.text (${colorway.text}) has ${ratio.toFixed(1)}:1 contrast against the background (${colorway.background}); body copy needs 4.5:1. Darken or lighten the text.`,
      );
    }
  }
  if (parsed.accent) {
    const ratio = contrastRatio(parsed.accent, parsed.background);
    if (ratio < 3) {
      errors.push(
        `theme.colorway.accent (${colorway.accent}) has ${ratio.toFixed(1)}:1 contrast against the background; buttons and rules need 3:1.`,
      );
    }
  }
}

// ------------------------------------------------------------------- products

function* refsOf(block: PlannedBlock, where: string): Generator<{ ref: Ref; path: string }> {
  switch (block.type) {
    case "productGrid":
    case "drop":
      for (const [i, ref] of block.products.entries()) yield { ref, path: `${where}.products[${i}]` };
      return;
    case "routine":
      for (const [i, step] of block.steps.entries()) yield { ref: step.product, path: `${where}.steps[${i}].product` };
      return;
    default:
      return;
  }
}

function checkRef(
  ref: Ref,
  path: string,
  byHandle: Map<string, IngestResult["catalogue"]["products"][number]>,
  errors: string[],
): void {
  const product = byHandle.get(ref.handle);
  if (!product) {
    errors.push(`${path}.handle is "${ref.handle}", which is not in the catalogue. Use only handles from the catalogue exactly as written.`);
    return;
  }

  if (ref.leadImageIndex !== undefined && ref.leadImageIndex >= product.images.length) {
    errors.push(
      `${path}.leadImageIndex is ${ref.leadImageIndex} but "${ref.handle}" has ${product.images.length} image${product.images.length === 1 ? "" : "s"} (valid indexes 0–${Math.max(0, product.images.length - 1)}). Omit it to use the first.`,
    );
  }

  if (ref.variantId !== undefined && !product.variants.some((v) => v.id === ref.variantId)) {
    errors.push(
      `${path}.variantId is "${ref.variantId}", which is not a variant of "${ref.handle}". Omit it to use the default variant.`,
    );
  }
}

// ------------------------------------------------------------- per-block rules

interface BlockCheck {
  block: PlannedBlock;
  where: string;
  prompt: string;
  byHandle: Map<string, IngestResult["catalogue"]["products"][number]>;
  allowedUrls: Set<string>;
  errors: string[];
  warnings: string[];
}

function checkBlockSpecifics({ block, where, prompt, byHandle, allowedUrls, errors, warnings }: BlockCheck): void {
  switch (block.type) {
    case "hero": {
      const media = block.media;
      if (media?.kind === "uploaded") {
        errors.push(`${where}.media uses "uploaded", which is not available yet. Use a productImage, or a brandAsset URL from the brief.`);
      }
      if (media?.kind === "brandAsset" && !allowedUrls.has(media.url)) {
        errors.push(`${where}.media.url is "${media.url}", which was not in the brief. Use only a brand image URL listed there, or lead with a productImage.`);
      }
      if (media?.kind === "productImage") {
        const product = byHandle.get(media.handle);
        if (!product) {
          errors.push(`${where}.media.handle is "${media.handle}", which is not in the catalogue.`);
        } else if (media.imageIndex >= product.images.length) {
          errors.push(
            `${where}.media.imageIndex is ${media.imageIndex} but "${media.handle}" has ${product.images.length} image${product.images.length === 1 ? "" : "s"}.`,
          );
        }
      }
      const url = block.cta?.url;
      if (url && !allowedUrls.has(url)) {
        errors.push(`${where}.cta.url is "${url}", which was not in the brief. Link only to a URL listed there, or use targetBlockId.`);
      }
      return;
    }

    case "linkList": {
      for (const [i, link] of block.links.entries()) {
        if (!allowedUrls.has(link.url)) {
          errors.push(`${where}.links[${i}].url is "${link.url}", which was not in the brief. Use only URLs listed there.`);
        }
      }
      return;
    }

    case "offer": {
      // A discount code the merchant did not give us is a code that does not
      // work at their checkout — the single most embarrassing thing this
      // product could put on a page.
      if (!promptContainsCode(prompt, block.code)) {
        errors.push(
          `${where}.code is "${block.code}", which does not appear in the merchant's brief. Never invent a discount code — drop the offer block instead.`,
        );
      }
      return;
    }

    case "drop": {
      if (block.launchesAt && !promptMentionsATime(prompt)) {
        errors.push(
          `${where}.launchesAt is set to "${block.launchesAt}" but the merchant's brief gives no launch date. The renderer counts down to it, so omit it.`,
        );
      }
      return;
    }

    case "productGrid":
    case "routine":
      warnLayout(block, where, warnings);
      return;
  }
}

function warnLayout(block: PlannedBlock, where: string, warnings: string[]): void {
  if (block.type !== "productGrid") return;
  if (block.products.length >= 4 && block.layout === "stack") {
    warnings.push(`${where} stacks ${block.products.length} products full-width; on a phone that is a long scroll. A grid or carousel usually reads better.`);
  }
}

// ----------------------------------------------------------------------- copy

function checkCopy(
  block: PlannedBlock,
  where: string,
  byHandle: Map<string, IngestResult["catalogue"]["products"][number]>,
  errors: string[],
): void {
  for (const { text, path } of copyOf(block, where)) {
    for (const claim of BANNED_CLAIMS) {
      const match = claim.pattern.exec(text);
      if (match) {
        errors.push(`${path} says "${match[0]}", which ${claim.why}. Rewrite it without that claim.`);
      }
    }

    for (const money of unqualifiedAmounts(text)) {
      errors.push(
        `${path} contains the price "${money}". Prices are resolved live by the renderer and must never appear in copy — the only exception is a threshold the merchant asked for, written as "under ${money}".`,
      );
    }
  }

  checkThresholdHonoured(block, where, byHandle, errors);
}

function* copyOf(block: PlannedBlock, where: string): Generator<{ text: string; path: string }> {
  const emit = function* (value: string | undefined, path: string) {
    if (value) yield { text: value, path };
  };

  switch (block.type) {
    case "hero":
      yield* emit(block.headline, `${where}.headline`);
      yield* emit(block.subline, `${where}.subline`);
      yield* emit(block.cta?.label, `${where}.cta.label`);
      return;
    case "productGrid":
      yield* emit(block.title, `${where}.title`);
      for (const [i, p] of block.products.entries()) yield* emit(p.blurb, `${where}.products[${i}].blurb`);
      return;
    case "drop":
      yield* emit(block.title, `${where}.title`);
      for (const [i, p] of block.products.entries()) yield* emit(p.blurb, `${where}.products[${i}].blurb`);
      return;
    case "routine":
      yield* emit(block.title, `${where}.title`);
      for (const [i, step] of block.steps.entries()) {
        yield* emit(step.label, `${where}.steps[${i}].label`);
        yield* emit(step.product.blurb, `${where}.steps[${i}].product.blurb`);
      }
      return;
    case "offer":
      yield* emit(block.description, `${where}.description`);
      return;
    case "linkList":
      for (const [i, link] of block.links.entries()) yield* emit(link.label, `${where}.links[${i}].label`);
      return;
  }
}

/** Amounts that are being asserted rather than used as a merchant's threshold. */

/**
 * "Everything under £80" has to actually be everything under £80.
 *
 * A threshold in a block's own title is a promise about the products directly
 * beneath it, and it is the one price claim the page is allowed to make — so
 * it is the one price claim worth checking.
 */
function checkThresholdHonoured(
  block: PlannedBlock,
  where: string,
  byHandle: Map<string, IngestResult["catalogue"]["products"][number]>,
  errors: string[],
): void {
  if (block.type !== "productGrid" && block.type !== "drop") return;
  if (!block.title) return;

  const cap = /(?:under|below|beneath|less than|up to|no more than)\s*[$£€¥₹]?\s?(\d[\d,]*(?:\.\d{1,2})?)/i.exec(block.title);
  if (!cap?.[1]) return;

  const limit = Number.parseFloat(cap[1].replace(/,/g, ""));
  if (!Number.isFinite(limit)) return;

  // Compared against the cheapest buyable variant: "under £80" is a claim that
  // the shopper can leave with it for under £80, not that every size is.
  const over = block.products
    .map((ref) => byHandle.get(ref.handle))
    .filter((product) => product !== undefined && product.price.min > limit);
  if (over.length > 0) {
    errors.push(
      `${where}.title promises "${cap[0]}" but ${over.length} of its products start above ${limit}. Remove them, or change the title to one the selection keeps.`,
    );
  }
}

// ------------------------------------------------------------------- warnings

function checkStock(
  plan: MerchandisingPlan,
  ingest: IngestResult,
  selected: Set<string>,
  prompt: string,
  warnings: string[],
): void {
  const soldOut = ingest.catalogue.products.filter((p) => p.availabilityKnown && !p.available);
  if (soldOut.length === 0 || selected.size === 0) return;
  if (/\bin[- ]stock\b|\bavailable\b|\bexclude sold[- ]out\b/i.test(prompt)) return;

  const keptSoldOut = soldOut.filter((p) => selected.has(p.handle)).length;
  if (keptSoldOut === 0) {
    warnings.push(
      `Every sold-out product was left out, and the brief did not ask for in-stock only. Sold-out products are meant to be shown and marked — check this was a merchandising call rather than a filter.`,
    );
  }
}

/**
 * Above this share of a catalogue, a plan has stopped selecting.
 *
 * Seven tenths is a judgement, not a measurement, and it is written here so
 * somebody can disagree with it. It was picked against the first real run:
 * the two briefs that failed to select came back at 100%, 90%, 90% and 80%,
 * and the two that selected well came back at 40% and 30%. Anything from about
 * 0.5 to 0.85 separates those; 0.7 sits in the middle of the gap.
 */
export const SELECTION_CEILING = 0.7;

/**
 * Below this many products, showing most of them is not a failure to choose.
 *
 * A store with six products has no edit to make, and warning about it would
 * train people to ignore the warning — which is the only thing that can
 * actually break a check like this.
 */
export const SELECTION_FLOOR = 8;

/**
 * Did it merchandise, or did it just put headings on the catalogue?
 *
 * The first real run found this and nothing else caught it: given a brief with
 * a constraint the model can check itself against — a price cap, a stock
 * filter, an ordering rule — it is disciplined. Given an open-ended one it
 * returned ten products out of ten, which is the catalogue with better
 * headings. The system prompt already says "fewer, better… every product you
 * add dilutes the ones you believe in", and saying it louder is not a fix; the
 * model was not confused, it was unchecked.
 *
 * **A warning rather than an error, deliberately.** The obvious move is to
 * reject and let the retry loop force a smaller selection, and it is wrong for
 * a reason the same run demonstrated: the best shop it produced — "still in
 * stock, cheapest first" — legitimately took every available product, because
 * breadth *was* the brief. A hard rule would have failed the one output that
 * needed no fixing. Nothing here can reliably tell a clearance edit from a
 * model that gave up, so it does not pretend to: it reports the number and
 * asks. A false positive costs a line somebody reads and dismisses; a false
 * negative ships the whole catalogue and calls it merchandising.
 *
 * The denominator is the catalogue as ingested. A truncated catalogue makes
 * the share look smaller than it is, which can only hide a problem, never
 * invent one.
 */
function checkSelection(
  ingest: IngestResult,
  selected: Set<string>,
  prompt: string,
  warnings: string[],
): void {
  const total = ingest.catalogue.products.length;
  if (total < SELECTION_FLOOR || selected.size === 0) return;

  // A brief that asks for the lot is not asking to be edited down. Kept
  // deliberately narrow — this is the one place a clever regex would start
  // guessing at intent, and guessing wrong here silences the check.
  if (/\b(everything|all of|the whole|entire|full (range|catalogue|catalog))\b/i.test(prompt)) return;

  const share = selected.size / total;
  if (share <= SELECTION_CEILING) return;

  warnings.push(
    `${selected.size} of ${total} products made the page (${Math.round(share * 100)}%). ` +
      `Above ${Math.round(SELECTION_CEILING * 100)}% this is closer to the catalogue with headings on it than to an edit — ` +
      `check the brief was specific enough to select against, and that everything here earns its place.`,
  );
}

function checkImagery(
  plan: MerchandisingPlan,
  byHandle: Map<string, IngestResult["catalogue"]["products"][number]>,
  warnings: string[],
): void {
  const imageless = new Set<string>();
  for (const entry of plan.blocks) {
    for (const { ref } of refsOf(entry.block, "")) {
      if (byHandle.get(ref.handle)?.images.length === 0) imageless.add(ref.handle);
    }
  }
  if (imageless.size > 0) {
    warnings.push(
      `${imageless.size} selected product${imageless.size === 1 ? " has" : "s have"} no imagery (${[...imageless].join(", ")}); the renderer needs a card treatment that survives that.`,
    );
  }
}

// ------------------------------------------------------------------- prompt

function promptContainsCode(prompt: string, code: string): boolean {
  const normalise = (value: string) => value.replace(/[^a-z0-9]/gi, "").toUpperCase();
  const wanted = normalise(code);
  return wanted.length > 0 && normalise(prompt).includes(wanted);
}

const MONTHS = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\b/i;
const RELATIVE = /\b(today|tomorrow|tonight|midnight|noon|next (week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|this (week|weekend|friday|saturday))\b/i;

function promptMentionsATime(prompt: string): boolean {
  return /\d/.test(prompt) || MONTHS.test(prompt) || RELATIVE.test(prompt);
}
