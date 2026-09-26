/**
 * Ranking the candidates (HANDOFF §7 step 3).
 *
 * Every candidate has already passed the rules. This decides which ones the
 * model gets to see, and in what order, from three things only:
 *
 * - **Genome concept match**, weighted by the value's *measured* confidence.
 *   A Father's Day fit agreed by five runs of five counts for more than one
 *   agreed by three.
 * - **The goal.** `move_stock` lifts deep stock, `aov` lifts add-ons and
 *   declared pairings, `launch` lifts the newest, and `conversion` lifts
 *   heroes.
 * - **Merchant locks**, which always make the cut.
 *
 * The points are hand-set constants in this file, and they are the whole
 * model. Nothing here reads a view, a click, a sale or any other outcome:
 * that is the drawer (`CLAUDE.md`), and the owner's ruling for M2 is that the
 * engine ranks from the catalogue and the brief alone.
 * `tests/stop-line.test.tsx` holds `lib/pop` to that.
 */

import { resolve, type GenomeValue } from "@/lib/genome/v1/records";
import { UNKNOWN } from "@/lib/genome/v1/taxonomy";
import { targetsOf, type PopBrief, type TargetDimension } from "./brief";
import type { Candidate } from "./filter";

/** Points per matched concept, before confidence. Hand-set; see the file comment. */
export const CONCEPT_POINTS: Record<TargetDimension, number> = {
  occasion_fit: 3,
  audience_fit: 3,
  use_context: 2,
  gift_role: 1.5,
  seasonality: 1,
  item_type: 1,
  style_register: 0.5,
};

/** A product made for someone the brief did not ask for (women's boots in a shop for dads). */
export const AUDIENCE_MISMATCH = -4;

/** Audiences that suit any adult brief. */
const AUDIENCE_NEUTRAL = new Set(["unisex_adult", "household"]);

export const LOCKED = 100;

export interface Scored {
  candidate: Candidate;
  score: number;
  /** Concepts matched, as `dimension:value (agreement)`. */
  matched: string[];
  /** Plain reasons, for the decision log. */
  notes: string[];
  locked: boolean;
  classified: boolean;
}

export function scoreCandidates(candidates: readonly Candidate[], brief: PopBrief, genome: readonly GenomeValue[]): Scored[] {
  const targets = targetsOf(brief);
  const locks = new Set(brief.rules.includeHandles);
  const byHandle = new Map<string, GenomeValue[]>();
  for (const v of resolve(genome)) byHandle.set(v.handle, [...(byHandle.get(v.handle) ?? []), v]);

  const candidateHandles = new Set(candidates.map((c) => c.product.handle));
  const newest = recencyRanks(candidates);

  const scored = candidates.map((candidate, index): Scored & { index: number } => {
    const handle = candidate.product.handle;
    const values = byHandle.get(handle) ?? [];
    const valuesOf = (dim: string) => values.filter((v) => v.dimension === dim && v.value !== UNKNOWN);
    const matched: string[] = [];
    const notes: string[] = [];
    let score = 0;

    for (const [dim, wanted] of targets) {
      if (wanted.size === 0) continue;
      for (const v of valuesOf(dim)) {
        if (!wanted.has(v.value)) continue;
        const confidence = v.confidence ?? 0.5;
        score += CONCEPT_POINTS[dim] * confidence;
        matched.push(`${dim}:${v.value}${v.runAgreement ? ` (${v.runAgreement})` : v.provenance === "merchant_declared" ? " (merchant)" : ""}`);
      }
    }

    const wantedAudience = targets.get("audience_fit")!;
    const audience = valuesOf("audience_fit").map((v) => v.value);
    if (wantedAudience.size && audience.length && !audience.some((a) => wantedAudience.has(a) || AUDIENCE_NEUTRAL.has(a))) {
      score += AUDIENCE_MISMATCH;
      notes.push(`made for ${audience.join("/")}, not ${[...wantedAudience].join("/")}`);
    }

    const one = (dim: string) => valuesOf(dim)[0]?.value;
    switch (brief.goal) {
      case "move_stock":
        if (one("inventory_depth") === "high") (score += 2), notes.push("deep stock (move_stock)");
        if (one("inventory_depth") === "low") (score -= 1), notes.push("low stock (move_stock)");
        break;
      case "aov": {
        if (one("assortment_role") === "add_on") (score += 1), notes.push("add-on (aov)");
        const pairs = valuesOf("known_pairings").filter((v) => candidateHandles.has(v.value)).length;
        if (pairs) (score += Math.min(2, pairs)), notes.push(`pairs with ${pairs} other candidate${pairs === 1 ? "" : "s"} (aov)`);
        break;
      }
      case "launch":
        if (newest.get(handle) === true) (score += 2), notes.push("among the newest (launch)");
        break;
      case "conversion":
        if (one("assortment_role") === "hero") (score += 1.5), notes.push("merchant hero (conversion)");
        if (one("price_position") === "mid") (score += 0.5), notes.push("mid-priced for the store (conversion)");
        break;
    }

    const locked = locks.has(handle);
    if (locked) {
      score += LOCKED;
      notes.push("locked in by the merchant");
    }
    if (values.length === 0) notes.push("not classified by Genome v1; ranked on the brief alone");
    return { candidate, score: Math.round(score * 1000) / 1000, matched, notes, locked, classified: values.length > 0, index };
  });

  // Stable: equal scores keep catalogue order, so a rerun ranks the same way.
  return scored.sort((a, b) => b.score - a.score || a.index - b.index).map(({ index: _i, ...rest }) => rest);
}

/** The newest quarter of the candidates, by published or created date. */
function recencyRanks(candidates: readonly Candidate[]): Map<string, boolean> {
  const dated = candidates
    .map((c) => ({ handle: c.product.handle, at: Date.parse(c.product.publishedAt ?? c.product.createdAt ?? "") }))
    .filter((d) => Number.isFinite(d.at))
    .sort((a, b) => b.at - a.at);
  const cut = Math.max(1, Math.ceil(dated.length / 4));
  return new Map(dated.map((d, i) => [d.handle, i < cut]));
}

/** The top of the ranking, locks always included, for the model to assemble from. */
export function shortlist(scored: readonly Scored[], size: number): Scored[] {
  const locked = scored.filter((s) => s.locked);
  const rest = scored.filter((s) => !s.locked).slice(0, Math.max(0, size - locked.length));
  return [...locked, ...rest];
}
