/**
 * Five runs in, one answer per dimension out, with a confidence that was
 * measured rather than reported (HANDOFF §6.1 rule 4, D6).
 *
 * Single-label: the modal value, confidence = its share of runs. A tie for
 * the top is `unknown` with no confidence. The runs disagreed, and choosing
 * between them would be us guessing on the model's behalf.
 *
 * Multi-label: every value named by a strict majority of runs (3 of 5), each
 * with its own share, capped at the dimension's maximum by count. If no value
 * reaches a majority the answer is `unknown`. Its confidence is the share of
 * runs that said unknown outright, when that was the majority; otherwise null.
 */

import { dimension, UNKNOWN, type ModelDimensionId } from "./taxonomy";

export interface ConsensusValue {
  value: string;
  /** 0–1, or null when the runs split and nothing was measured. */
  confidence: number | null;
  /** e.g. "4/5". */
  agreement: string;
  /** The raw distribution, for a human debugging a split. */
  distribution: string;
}

/** One run's answer: a value for single-label dimensions, an array for multi. */
export type RunAnswer = Record<string, string | string[]>;

export function consensus(dim: ModelDimensionId, runs: readonly RunAnswer[]): ConsensusValue[] {
  const def = dimension(dim);
  const n = runs.length;
  if (n === 0) return [{ value: UNKNOWN, confidence: null, agreement: "0/0", distribution: "no runs" }];

  const counts = new Map<string, number>();
  for (const run of runs) {
    const raw = run[dim];
    const answer = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];
    const distinct = new Set(answer.length === 0 ? [UNKNOWN] : answer);
    // "unknown" beside a real value is a contradiction; the real value stands.
    if (distinct.size > 1) distinct.delete(UNKNOWN);
    for (const value of distinct) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  const distribution = ranked.map(([value, c]) => `${value}:${c}`).join(" ");

  if (def.cardinality === "single") {
    const [top, second] = ranked;
    if (!top || (second && second[1] === top[1])) {
      return [{ value: UNKNOWN, confidence: null, agreement: `${top?.[1] ?? 0}/${n}`, distribution }];
    }
    return [{ value: top[0], confidence: top[1] / n, agreement: `${top[1]}/${n}`, distribution }];
  }

  const majority = Math.floor(n / 2) + 1;
  const kept = ranked.filter(([value, c]) => value !== UNKNOWN && c >= majority).slice(0, def.maxLabels ?? Infinity);
  if (kept.length === 0) {
    const unknownVotes = counts.get(UNKNOWN) ?? 0;
    return [
      {
        value: UNKNOWN,
        confidence: unknownVotes >= majority ? unknownVotes / n : null,
        agreement: `${unknownVotes}/${n}`,
        distribution,
      },
    ];
  }
  return kept.map(([value, c]) => ({ value, confidence: c / n, agreement: `${c}/${n}`, distribution }));
}

/** The parent category, by the same single-label rule; null on a split. */
export function consensusCategory(runs: readonly { parent_category?: string }[]): string | null {
  const counts = new Map<string, number>();
  for (const run of runs) if (run.parent_category) counts.set(run.parent_category, (counts.get(run.parent_category) ?? 0) + 1);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const [top, second] = ranked;
  if (!top || (second && second[1] === top[1])) return null;
  return top[0];
}
