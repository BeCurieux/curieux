/**
 * Validate the assembled POP against the rules again, in code (HANDOFF §7
 * step 5), and repair rather than publish a violation.
 *
 * The model assembled from the shortlist only; the merchandiser's own
 * validation already refuses a handle that is not in what it was given. This
 * is the second, independent check, because the rules are the one part of a
 * POP a merchant will hold us to:
 *
 * - every product shown is on the shortlist and passed the hard filter;
 * - a product whose variants straddle the price cap is shown pinned to the
 *   variant that keeps it, whatever variant the plan chose;
 * - nothing excluded appears; everything locked does.
 *
 * Repairs are recorded, never silent. A POP that can only be made legal by
 * removing everything is an error, not an empty page.
 */

import { ShopConfig } from "@/lib/schema";
import type { PopBrief } from "./brief";
import type { Scored } from "./score";

export interface GuardResult {
  config: ShopConfig;
  repairs: string[];
  /** Handles the guard itself added (missing locks). */
  added: Set<string>;
}

type Ref = { handle: string; variantId?: string | undefined; blurb?: string; leadImageIndex?: number };

export class GuardError extends Error {}

export function guardPop(config: ShopConfig, brief: PopBrief, shortlist: readonly Scored[]): GuardResult {
  const allowed = new Map(shortlist.map((s) => [s.candidate.product.handle, s]));
  const exclude = new Set(brief.rules.excludeHandles);
  const cap = brief.rules.priceScope === "per_item" ? brief.rules.priceMax : null;
  const repairs: string[] = [];
  const added = new Set<string>();

  /** Returns the ref to keep (possibly re-pinned), or null to drop it. */
  const check = (ref: Ref, where: string): Ref | null => {
    const s = allowed.get(ref.handle);
    if (!s || exclude.has(ref.handle)) {
      repairs.push(`${where}: removed "${ref.handle}", which is not on the shortlist.`);
      return null;
    }
    const pinned = s.candidate.pinnedVariantId;
    if (ref.variantId) {
      const variant = s.candidate.product.variants.find((v) => v.id === ref.variantId);
      const ok = variant && variant.available && (cap === null || variant.price <= cap);
      if (ok) return ref;
      repairs.push(`${where}: "${ref.handle}" pointed at a variant that breaks the rules; ${pinned ? "re-pinned" : "unpinned"}.`);
      const { variantId: _v, ...rest } = ref;
      return pinned ? { ...rest, variantId: pinned } : rest;
    }
    if (pinned) return { ...ref, variantId: pinned };
    return ref;
  };

  const blocks: ShopConfig["blocks"] = [];
  for (const { id, block } of config.blocks) {
    switch (block.type) {
      case "productGrid": {
        const products = block.products.map((p) => check(p, id)).filter((p): p is Ref => p !== null);
        if (products.length) blocks.push({ id, block: { ...block, products } });
        else repairs.push(`${id}: dropped, nothing in it survived the rules.`);
        break;
      }
      case "drop": {
        const products = block.products.map((p) => check(p, id)).filter((p): p is Ref => p !== null);
        if (products.length) blocks.push({ id, block: { ...block, products } });
        else repairs.push(`${id}: dropped, nothing in it survived the rules.`);
        break;
      }
      case "routine": {
        const steps = block.steps.map((st) => ({ ...st, product: check(st.product, id) })).filter((st): st is typeof st & { product: Ref } => st.product !== null);
        if (steps.length >= 2) blocks.push({ id, block: { ...block, steps } });
        else repairs.push(`${id}: dropped, fewer than two steps survived the rules.`);
        break;
      }
      case "hero": {
        const media = block.media;
        if (media?.kind === "productImage" && (!allowed.has(media.handle) || exclude.has(media.handle))) {
          const { media: _m, ...rest } = block;
          blocks.push({ id, block: rest });
          repairs.push(`${id}: hero image of "${media.handle}" removed; that product is not on the shortlist.`);
        } else blocks.push({ id, block });
        break;
      }
      default:
        blocks.push({ id, block });
    }
  }

  // Locks the plan left out go into the first grid, or a grid of their own.
  const shown = new Set(handlesIn({ ...config, blocks }));
  const missing = brief.rules.includeHandles.filter((h) => !shown.has(h) && allowed.has(h));
  if (missing.length) {
    const refs = missing.map((h) => check({ handle: h }, "locks")!);
    const grid = blocks.find((b) => b.block.type === "productGrid");
    if (grid && grid.block.type === "productGrid" && grid.block.products.length + refs.length <= 12) {
      grid.block = { ...grid.block, products: [...refs, ...grid.block.products] };
    } else {
      blocks.splice(Math.min(1, blocks.length), 0, { id: "locked", block: { type: "productGrid", title: "Chosen for you", products: refs.slice(0, 12), layout: "grid" } });
    }
    for (const h of missing) added.add(h);
    repairs.push(`Added ${missing.length} locked product${missing.length === 1 ? "" : "s"} the plan left out: ${missing.join(", ")}.`);
  }

  if (!blocks.some((b) => ["productGrid", "drop", "routine"].includes(b.block.type))) {
    throw new GuardError("Nothing the plan chose survives the rules. The brief may be narrower than this catalogue can serve.");
  }
  const parsed = ShopConfig.safeParse({ ...config, blocks: blocks.slice(0, 10) });
  if (!parsed.success) throw new GuardError(`The repaired POP is not a valid shop: ${parsed.error.issues[0]?.message ?? "unknown"}`);
  return { config: parsed.data, repairs, added };
}

/** Every product handle the page shows, in page order, first appearance only. */
export function handlesIn(config: ShopConfig): string[] {
  const out: string[] = [];
  const push = (h: string) => {
    if (!out.includes(h)) out.push(h);
  };
  for (const { block } of config.blocks) {
    if (block.type === "hero" && block.media?.kind === "productImage") push(block.media.handle);
    if (block.type === "productGrid" || block.type === "drop") block.products.forEach((p) => push(p.handle));
    if (block.type === "routine") block.steps.forEach((s) => push(s.product.handle));
  }
  return out;
}

/** The pinned variant (if any) each shown handle carries on the page. */
export function variantsIn(config: ShopConfig): Map<string, string | undefined> {
  const out = new Map<string, string | undefined>();
  for (const { block } of config.blocks) {
    const refs = block.type === "productGrid" || block.type === "drop" ? block.products : block.type === "routine" ? block.steps.map((s) => s.product) : [];
    for (const r of refs) if (!out.has(r.handle)) out.set(r.handle, r.variantId);
  }
  return out;
}
