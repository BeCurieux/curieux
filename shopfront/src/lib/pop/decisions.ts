/**
 * The decision log (HANDOFF §7 step 6): one row per product per version,
 * saying where it sits, what job it does, and why it is there.
 *
 * What POPUUP chose to show is recorded separately from anything that happens
 * after (Genome rule 6). This file writes the first half and never reads the
 * second. `is_exploration` is always false: reserved exposure (D7) waits on
 * its own ruling, and a column that is always false is honest about that.
 */

import type { ShopConfig } from "@/lib/schema";
import { handlesIn } from "./guard";
import type { Scored } from "./score";

export type DecisionSource = "engine" | "merchant_lock" | "maintenance_replacement";
export type PopRole = "hero" | "supporting" | "add_on";

export interface PopDecision {
  handle: string;
  /** 1-based, in page order. */
  position: number;
  role: PopRole;
  reason: string;
  concepts: string[];
  score: number;
  isExploration: false;
  decisionSource: DecisionSource;
}

export function decisionsFor(config: ShopConfig, shortlist: readonly Scored[], added: ReadonlySet<string>): PopDecision[] {
  const scored = new Map(shortlist.map((s) => [s.candidate.product.handle, s]));
  const heroMedia = config.blocks.find((b) => b.block.type === "hero")?.block;
  const heroHandle = heroMedia?.type === "hero" && heroMedia.media?.kind === "productImage" ? heroMedia.media.handle : undefined;
  const handles = handlesIn(config);
  const hero = heroHandle ?? handles[0];

  return handles.map((handle, i) => {
    const s = scored.get(handle);
    const addOn = s?.notes.some((n) => n.startsWith("add-on")) ?? false;
    const role: PopRole = handle === hero ? "hero" : addOn ? "add_on" : "supporting";
    const why = [
      ...(s?.matched.length ? [`matches ${s.matched.join(", ")}`] : []),
      ...(s?.notes ?? []),
      ...(added.has(handle) ? ["added by the guard: locked in but left out of the plan"] : []),
    ];
    return {
      handle,
      position: i + 1,
      role,
      reason: why.join("; ") || "chosen by the model from the shortlist",
      concepts: s?.matched.map((m) => m.split(" ")[0]!) ?? [],
      score: s?.score ?? 0,
      isExploration: false,
      decisionSource: s?.locked ? "merchant_lock" : "engine",
    };
  });
}
