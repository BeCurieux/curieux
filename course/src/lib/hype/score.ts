import rubricJson from "../../../content/hype/rubric.json";

// The Hype Check (SPEC.md → Email, keywords and lead capture): a weighted
// keyword rubric, no AI, so it's free to run. Pure, and unit-tested.
//
// Score = for each signal, weight × matches (up to its max), plus, when the
// post makes any such claim, the weight of each thing it leaves out (costs,
// hours). Capped at 100. A post that claims nothing isn't marked down for
// not mentioning its costs.
//
// "The three things it leaves out" are the first three omissions, in rubric
// order, that the post doesn't mention.

export interface Rubric {
  version: string;
  draft?: boolean;
  signals: { id: string; label: string; weight: number; max: number; patterns: string[] }[];
  omissions: { id: string; weight: number; finding: string; patterns: string[] }[];
}

export const RUBRIC = rubricJson as Rubric;

export interface HypeResult {
  score: number;
  band: "Mostly grounded" | "Some hype" | "Heavy hype";
  signals: { id: string; label: string; matches: string[] }[];
  leavesOut: string[];
  rubricVersion: string;
}

export const MIN_LENGTH = 20;
export const MAX_LENGTH = 5000;

function matchesOf(text: string, patterns: string[]): string[] {
  const found: string[] = [];
  for (const source of patterns)
    for (const m of text.matchAll(new RegExp(source, "gi"))) found.push(m[0].trim());
  return found;
}

export function scoreHype(text: string, rubric: Rubric = RUBRIC): HypeResult {
  const signals = rubric.signals
    .map((signal) => ({ signal, matches: matchesOf(text, signal.patterns) }))
    .filter((s) => s.matches.length > 0);
  const claims = signals.length > 0;
  const missing = rubric.omissions.filter((o) => matchesOf(text, o.patterns).length === 0);

  let score = 0;
  for (const { signal, matches } of signals)
    score += signal.weight * Math.min(matches.length, signal.max);
  if (claims) for (const omission of missing) score += omission.weight;
  score = Math.min(100, Math.round(score));

  return {
    score,
    band: score < 30 ? "Mostly grounded" : score < 60 ? "Some hype" : "Heavy hype",
    signals: signals.map(({ signal, matches }) => ({
      id: signal.id,
      label: signal.label,
      matches,
    })),
    leavesOut: missing.slice(0, 3).map((o) => o.finding),
    rubricVersion: rubric.version,
  };
}

/** For the tuning log: nothing that identifies a person or account. */
export function redact(text: string): string {
  return text
    .slice(0, MAX_LENGTH)
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .replace(/\b(?:https?:\/\/|www\.)\S+?(?=[.,;:!?)]*(?:\s|$))/gi, "[link]")
    .replace(/(^|\s)@[\w.]{2,}/g, "$1[handle]")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[phone]");
}
