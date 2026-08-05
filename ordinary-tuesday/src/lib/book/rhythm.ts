// Editorial rhythm (brief §11).
//
// The single thing that separates an authored book from a filled template is
// pacing. A book that goes photo → caption → photo → caption for eighty pages
// reads as a machine output no matter how good the individual pages are.
//
// So the composer never simply appends pages. It scores candidate orderings
// against a rhythm: dense pages must be followed by quiet ones, the same
// archetype never repeats back to back, and a spread should not present two
// pages of the same density.

import { ARCHETYPES, getArchetype, type ArchetypeId } from "./templates";

const DENSITY_WEIGHT = { sparse: 0, medium: 1, dense: 2 } as const;

export interface PagePlan {
  archetype: ArchetypeId;
  sectionIndex: number;
  /** Content the page will carry; opaque to the rhythm engine. */
  payload: unknown;
}

/**
 * How badly a sequence violates the rhythm. Lower is better; 0 is ideal.
 * Pure and deterministic, so page order is reproducible between renders.
 */
export function rhythmPenalty(pages: PagePlan[]): number {
  let penalty = 0;

  for (let i = 1; i < pages.length; i++) {
    const prev = getArchetype(pages[i - 1].archetype);
    const cur = getArchetype(pages[i].archetype);

    // The same layout twice running reads as a template.
    if (prev.id === cur.id) penalty += 6;

    // Two dense pages in a row is exhausting; two sparse is empty.
    const a = DENSITY_WEIGHT[prev.density];
    const b = DENSITY_WEIGHT[cur.density];
    if (a === 2 && b === 2) penalty += 4;
    if (a === 0 && b === 0 && prev.photoSlots === 0 && cur.photoSlots === 0) penalty += 3;

    // A spread of two identical densities is flat. Interior page i+1 is on
    // the right when odd, so pages 2&3, 4&5 … face each other.
    const facing = (i + 1) % 2 === 1;
    if (facing && a === b) penalty += 2;
  }

  // A book should open and close quietly.
  if (pages.length) {
    if (getArchetype(pages[0].archetype).density === "dense") penalty += 5;
    if (getArchetype(pages[pages.length - 1].archetype).density === "dense") penalty += 5;
  }

  return penalty;
}

/**
 * Reorder pages within their own section to improve rhythm, never across
 * sections — chapter order is editorial and belongs to the structure.
 * Greedy: repeatedly take whichever remaining page hurts least next.
 */
export function pace(pages: PagePlan[]): PagePlan[] {
  const bySection = new Map<number, PagePlan[]>();
  for (const p of pages) {
    if (!bySection.has(p.sectionIndex)) bySection.set(p.sectionIndex, []);
    bySection.get(p.sectionIndex)!.push(p);
  }

  const out: PagePlan[] = [];
  for (const sectionIndex of [...bySection.keys()].sort((a, b) => a - b)) {
    const remaining = [...bySection.get(sectionIndex)!];
    // A chapter opener always leads its section.
    const openerIdx = remaining.findIndex((p) => p.archetype === "chapter_opener");
    if (openerIdx > 0) out.push(...remaining.splice(openerIdx, 1));
    else if (openerIdx === 0) out.push(...remaining.splice(0, 1));

    while (remaining.length) {
      let bestIdx = 0;
      let bestScore = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const score = rhythmPenalty([...out.slice(-2), remaining[i]]);
        if (score < bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }
      out.push(...remaining.splice(bestIdx, 1));
    }
  }
  return out;
}

/**
 * Interior extent must be even so the book binds, and should land near the
 * target so volumes line up on a shelf year after year (brief §3).
 * Padding uses quiet pages, never filler photographs.
 */
export function padToEven(pages: PagePlan[]): PagePlan[] {
  if (pages.length % 2 === 0) return pages;
  const last = pages[pages.length - 1];
  return [
    ...pages,
    { archetype: "quote_page" as ArchetypeId, sectionIndex: last?.sectionIndex ?? 0, payload: null },
  ];
}

/** Summary used by the admin panel and tests to judge a generated book. */
export function rhythmReport(pages: PagePlan[]) {
  const counts: Record<string, number> = {};
  for (const p of pages) counts[p.archetype] = (counts[p.archetype] ?? 0) + 1;
  const variety = Object.keys(counts).length / Object.keys(ARCHETYPES).length;
  return { penalty: rhythmPenalty(pages), counts, variety, pageCount: pages.length };
}
