/**
 * The Genome quality harness (HANDOFF §8).
 *
 * Two questions, in order, and the second is not asked until the first has
 * an answer:
 *
 * 1. **Do two merchandisers agree?** Cohen's kappa per dimension, between two
 *    labellers working blind from the spec. ≥ 0.6 keep · 0.4–0.6 tighten the
 *    definitions and relabel · < 0.4 merge, redefine or drop. A dimension that
 *    humans cannot agree on is not a dimension the model can be right about.
 * 2. **Does the model agree with them, as well as they agree with each
 *    other?** Against adjudicated gold: accuracy, repeat-run consistency (≥ 4
 *    of 5), calibration by agreement bucket, the unknown rate, and whether
 *    anything shifted since the last run without a prompt, model or taxonomy
 *    change to explain it.
 *
 * Multi-label dimensions are scored per value as present/absent, then
 * averaged over the values either labeller used. That is the usual reduction,
 * and it stops one common value (everyday) from hiding disagreement on the
 * rare ones that matter (fathers_day).
 */

import type { GenomeValue } from "./records";
import type { GoldLabel, Verdict } from "./store";
import { dimension, MODEL_DIMENSIONS, UNKNOWN, type ModelDimensionId } from "./taxonomy";

// ------------------------------------------------------------------- kappa

/**
 * Cohen's kappa for two raters over the same items. Null when chance
 * agreement is total (both raters used one category throughout), where kappa
 * is undefined, and reporting 1 or 0 would each be a claim nobody measured.
 */
export function cohensKappa(pairs: readonly [string, string][]): number | null {
  const n = pairs.length;
  if (n === 0) return null;
  const a = new Map<string, number>();
  const b = new Map<string, number>();
  let agree = 0;
  for (const [x, y] of pairs) {
    if (x === y) agree += 1;
    a.set(x, (a.get(x) ?? 0) + 1);
    b.set(y, (b.get(y) ?? 0) + 1);
  }
  const po = agree / n;
  let pe = 0;
  for (const [k, count] of a) pe += (count / n) * ((b.get(k) ?? 0) / n);
  if (pe >= 1) return null;
  return (po - pe) / (1 - pe);
}

const setKey = (labels: readonly string[]) => [...labels].sort().join("|");

export function verdictFor(kappa: number | null, items: number, minItems: number): Verdict {
  if (kappa === null || items < minItems) return "insufficient";
  if (kappa >= 0.6) return "keep";
  if (kappa >= 0.4) return "tighten";
  return "redefine";
}

// --------------------------------------------------------------- agreement

export interface DimensionAgreement {
  dimension: ModelDimensionId;
  items: number;
  /** Share of items where the two labellers gave exactly the same answer. */
  observed: number;
  kappa: number | null;
  verdict: Verdict;
  /** Multi-label only: kappa per value. */
  perValue?: Record<string, number | null>;
}

type Answers = Map<string, Map<ModelDimensionId, string[]>>;

function answersOf(labels: readonly GoldLabel[], labellerId: string, taxonomyVersion: string): Answers {
  const out: Answers = new Map();
  for (const l of labels) {
    if (l.labellerId !== labellerId || l.taxonomyVersion !== taxonomyVersion) continue;
    const item = out.get(l.itemId) ?? new Map();
    item.set(l.dimension as ModelDimensionId, l.labels);
    out.set(l.itemId, item);
  }
  return out;
}

export const MIN_GATE_ITEMS = 30;

export function agreement(
  labels: readonly GoldLabel[],
  labellerA: string,
  labellerB: string,
  taxonomyVersion: string,
  minItems = MIN_GATE_ITEMS,
): DimensionAgreement[] {
  const a = answersOf(labels, labellerA, taxonomyVersion);
  const b = answersOf(labels, labellerB, taxonomyVersion);

  return MODEL_DIMENSIONS.map((dim) => {
    const both: [string[], string[]][] = [];
    for (const [item, dims] of a) {
      const x = dims.get(dim);
      const y = b.get(item)?.get(dim);
      if (x && y) both.push([x, y]);
    }
    const observed = both.length ? both.filter(([x, y]) => setKey(x) === setKey(y)).length / both.length : 0;

    if (dimension(dim).cardinality === "single") {
      const kappa = cohensKappa(both.map(([x, y]) => [x[0]!, y[0]!]));
      return { dimension: dim, items: both.length, observed, kappa, verdict: verdictFor(kappa, both.length, minItems) };
    }

    const used = new Set(both.flatMap(([x, y]) => [...x, ...y]));
    const perValue: Record<string, number | null> = {};
    for (const value of [...used].sort()) {
      perValue[value] = cohensKappa(both.map(([x, y]) => [String(x.includes(value)), String(y.includes(value))]));
    }
    const measured = Object.values(perValue).filter((k): k is number => k !== null);
    const kappa = measured.length ? measured.reduce((s, k) => s + k, 0) / measured.length : null;
    return { dimension: dim, items: both.length, observed, kappa, verdict: verdictFor(kappa, both.length, minItems), perValue };
  });
}

// -------------------------------------------------------------------- gold

export interface Gold {
  /** item → dimension → the agreed (or adjudicated) answer. */
  answers: Answers;
  agreed: number;
  adjudicated: number;
  /** Disagreements with no adjudication: left out of model scoring, and counted. */
  unresolved: number;
}

/**
 * Where the two labellers agree, that is the gold answer. Where they
 * disagree, the adjudicator's answer is, if there is one. Otherwise the item
 * is left out of model scoring for that dimension. It is not averaged, and not
 * resolved in the model's favour.
 */
export function adjudicatedGold(
  labels: readonly GoldLabel[],
  labellerA: string,
  labellerB: string,
  taxonomyVersion: string,
  adjudicator?: string,
): Gold {
  const a = answersOf(labels, labellerA, taxonomyVersion);
  const b = answersOf(labels, labellerB, taxonomyVersion);
  const c = adjudicator ? answersOf(labels, adjudicator, taxonomyVersion) : new Map();
  const answers: Answers = new Map();
  let agreed = 0;
  let adjudicated = 0;
  let unresolved = 0;
  for (const [item, dims] of a) {
    for (const [dim, x] of dims) {
      const y = b.get(item)?.get(dim);
      if (!y) continue;
      let gold: string[] | undefined;
      if (setKey(x) === setKey(y)) {
        gold = x;
        agreed += 1;
      } else if (c.get(item)?.get(dim)) {
        gold = c.get(item)!.get(dim)!;
        adjudicated += 1;
      } else {
        unresolved += 1;
      }
      if (gold) {
        const m = answers.get(item) ?? new Map();
        m.set(dim, gold);
        answers.set(item, m);
      }
    }
  }
  return { answers, agreed, adjudicated, unresolved };
}

// ------------------------------------------------------------------- model

export interface ModelDimensionScore {
  dimension: ModelDimensionId;
  items: number;
  /** Exact match (the whole set, for multi-label). */
  accuracy: number | null;
  /** Mean Jaccard overlap; multi-label only. */
  overlap?: number | null;
  /** Share of items where every returned value had ≥ 4 of 5 runs agreeing. */
  consistency: number | null;
  /** Accuracy within each agreement bucket, and how many items fell in it. */
  calibration: Record<string, { items: number; accuracy: number | null }>;
  unknownRate: number | null;
  humanUnknownRate: number | null;
}

const ratio = (num: number, den: number) => (den ? num / den : null);

function bucketOf(rows: readonly GenomeValue[]): string {
  const confidences = rows.map((r) => r.confidence);
  if (confidences.some((c) => c === null)) return "split";
  const min = Math.min(...(confidences as number[]));
  if (min >= 1) return "5/5";
  if (min >= 0.8) return "4/5";
  return "3/5 or less";
}

/** Model values must be keyed by gold item id (see `goldCatalogue`). */
export function scoreModel(gold: Gold, modelValues: readonly GenomeValue[]): ModelDimensionScore[] {
  const byItem = new Map<string, Map<string, GenomeValue[]>>();
  for (const v of modelValues) {
    if (v.provenance !== "taxonomy_model") continue;
    const dims = byItem.get(v.handle) ?? new Map<string, GenomeValue[]>();
    dims.set(v.dimension, [...(dims.get(v.dimension) ?? []), v]);
    byItem.set(v.handle, dims);
  }

  return MODEL_DIMENSIONS.map((dim) => {
    const multi = dimension(dim).cardinality === "multi";
    let items = 0;
    let exact = 0;
    let overlapSum = 0;
    let consistent = 0;
    let modelUnknown = 0;
    let humanUnknown = 0;
    const buckets: Record<string, { items: number; correct: number }> = {};

    for (const [item, dims] of gold.answers) {
      const truth = dims.get(dim);
      const rows = byItem.get(item)?.get(dim);
      if (!truth || !rows?.length) continue;
      items += 1;
      const predicted = rows.map((r) => r.value);
      const match = setKey(predicted) === setKey(truth);
      if (match) exact += 1;
      if (multi) {
        const inter = predicted.filter((p) => truth.includes(p)).length;
        const union = new Set([...predicted, ...truth]).size;
        overlapSum += union ? inter / union : 1;
      }
      if (rows.every((r) => r.confidence !== null && r.confidence >= 0.8)) consistent += 1;
      if (predicted.includes(UNKNOWN)) modelUnknown += 1;
      if (truth.includes(UNKNOWN)) humanUnknown += 1;
      const bucket = bucketOf(rows);
      buckets[bucket] ??= { items: 0, correct: 0 };
      buckets[bucket].items += 1;
      if (match) buckets[bucket].correct += 1;
    }

    return {
      dimension: dim,
      items,
      accuracy: ratio(exact, items),
      ...(multi ? { overlap: ratio(overlapSum, items) } : {}),
      consistency: ratio(consistent, items),
      calibration: Object.fromEntries(Object.entries(buckets).map(([k, b]) => [k, { items: b.items, accuracy: ratio(b.correct, b.items) }])),
      unknownRate: ratio(modelUnknown, items),
      humanUnknownRate: ratio(humanUnknown, items),
    };
  });
}

// --------------------------------------------------------------- stability

export interface Shift {
  dimension: ModelDimensionId;
  changed: number;
  compared: number;
  /** True when labels moved with the same model, prompt and taxonomy: a silent shift. */
  silent: boolean;
}

/** Compare two model runs over the same items (HANDOFF §8: no silent label shifts). */
export function labelShifts(previous: readonly GenomeValue[], current: readonly GenomeValue[]): Shift[] {
  const keyed = (rows: readonly GenomeValue[]) => {
    const m = new Map<string, string[]>();
    for (const r of rows) {
      if (r.provenance !== "taxonomy_model") continue;
      const k = `${r.handle}\u0000${r.dimension}`;
      m.set(k, [...(m.get(k) ?? []), r.value]);
    }
    return m;
  };
  const before = keyed(previous);
  const after = keyed(current);
  const signature = (rows: readonly GenomeValue[]) =>
    new Set(rows.filter((r) => r.provenance === "taxonomy_model").map((r) => `${r.model}|${r.promptVersion}|${r.taxonomyVersion}`));
  const sameConfig = [...signature(previous)].sort().join() === [...signature(current)].sort().join();

  return MODEL_DIMENSIONS.map((dim) => {
    let changed = 0;
    let compared = 0;
    for (const [k, values] of after) {
      if (!k.endsWith(`\u0000${dim}`)) continue;
      const old = before.get(k);
      if (!old) continue;
      compared += 1;
      if (setKey(old) !== setKey(values)) changed += 1;
    }
    return { dimension: dim, changed, compared, silent: sameConfig && changed > 0 };
  });
}

// ------------------------------------------------------------------ report

const pct = (x: number | null | undefined) => (x === null || x === undefined ? "—" : `${Math.round(x * 100)}%`);
const k2 = (x: number | null) => (x === null ? "—" : x.toFixed(2));

export function agreementMarkdown(rows: readonly DimensionAgreement[], context: { labellers: [string, string]; taxonomyVersion: string; at: string }): string {
  return [
    `# Genome agreement gate: ${context.taxonomyVersion}`,
    "",
    `${context.at} · labellers: ${context.labellers[0]} and ${context.labellers[1]} · minimum ${MIN_GATE_ITEMS} items per dimension`,
    "",
    "Gate: κ ≥ 0.60 keep · 0.40–0.60 tighten definitions and relabel · < 0.40 merge, redefine or drop.",
    "",
    "| Dimension | Items | Exact agreement | κ | Verdict |",
    "|---|---:|---:|---:|---|",
    ...rows.map((r) => `| ${r.dimension} | ${r.items} | ${pct(r.observed)} | ${k2(r.kappa)} | ${r.verdict} |`),
    "",
    ...rows
      .filter((r) => r.perValue)
      .flatMap((r) => [
        `## ${r.dimension}, per value`,
        "",
        ...Object.entries(r.perValue!).map(([value, kappa]) => `- ${value}: κ ${k2(kappa)}`),
        "",
      ]),
  ].join("\n");
}

export function modelMarkdown(
  scores: readonly ModelDimensionScore[],
  context: { model: string; promptVersion: string; taxonomyVersion: string; at: string; gold: Gold; gate: ReadonlyMap<string, Verdict>; human: ReadonlyMap<string, number>; shifts?: readonly Shift[] },
): string {
  return [
    `# Genome model eval: ${context.model}`,
    "",
    `${context.at} · ${context.taxonomyVersion} · prompt ${context.promptVersion}`,
    "",
    `Gold: ${context.gold.agreed} agreed, ${context.gold.adjudicated} adjudicated, ${context.gold.unresolved} unresolved (left out).`,
    "Target: accuracy near human–human exact agreement, and consistency ≥ 4 of 5 runs.",
    "",
    "| Dimension | Gate | Items | Model accuracy | Human agreement | Overlap | Consistency ≥4/5 | Unknown (model / human) |",
    "|---|---|---:|---:|---:|---:|---:|---|",
    ...scores.map(
      (s) =>
        `| ${s.dimension} | ${context.gate.get(s.dimension) ?? "not run"} | ${s.items} | ${pct(s.accuracy)} | ${pct(context.human.get(s.dimension))} | ${s.overlap === undefined ? "" : pct(s.overlap)} | ${pct(s.consistency)} | ${pct(s.unknownRate)} / ${pct(s.humanUnknownRate)} |`,
    ),
    "",
    "## Calibration: accuracy by run agreement",
    "",
    ...scores.map(
      (s) =>
        `- ${s.dimension}: ${Object.entries(s.calibration)
          .map(([bucket, c]) => `${bucket} → ${pct(c.accuracy)} (n=${c.items})`)
          .join(" · ") || "no items"}`,
    ),
    "",
    ...(context.shifts
      ? [
          "## Stability against the previous run",
          "",
          ...context.shifts.map((s) => `- ${s.dimension}: ${s.changed} of ${s.compared} changed${s.silent ? " — **silent shift: same model, prompt and taxonomy**" : ""}`),
          "",
        ]
      : []),
  ].join("\n");
}
