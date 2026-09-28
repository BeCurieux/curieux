/**
 * Drafting a rewrite, and refusing to ship a bad one.
 *
 * The order is: try the exact fix, then ask the model, and put everything
 * through the same gate. What comes back says where it came from and, when
 * nothing survived, why — because "no rewrite" beside the rule's own remedy is
 * an honest result, and a wrong rewrite displacing a correct remedy is not.
 *
 * A rewrite is drafted per **mark** — one phrase, every rule it tripped —
 * because the brand needs one sentence that satisfies all of them, and because
 * "eco-friendly" tripping three markets is one problem rather than three.
 */

import type { Finding, Jurisdiction } from "../engine/types.js";
import { rewriteKey } from "../card/page.js";
import type { Mark } from "../card/annotate.js";
import { mechanicalRewrite } from "./deterministic.js";
import { validateRewrite, type RejectionCode } from "./validate.js";
import { DEFAULT_CANDIDATES, type Drafter } from "./model.js";

export type RewriteSource = "mechanical" | "model";

export type Rewrite = {
  /** The phrase as it appears on the page. */
  claim: string;
  /** What to put in its place. */
  text: string;
  source: RewriteSource;
  /** Rules this draft was written to answer, and has been checked against. */
  ruleIds: string[];
  /** Drafts that were rejected on the way, and why. Kept: it is the audit. */
  rejected: { text: string; code: RejectionCode; reason: string }[];
};

export type NoRewrite = {
  claim: string;
  ruleIds: string[];
  /** Why nothing shipped. The card falls back to the rule's remedy. */
  reason: string;
  rejected: { text: string; code: RejectionCode; reason: string }[];
};

export type MarkOutcome = { ok: true; rewrite: Rewrite } | { ok: false; miss: NoRewrite };

export type RewriteOptions = {
  /** Absent means mechanical-only, which is the offline default. */
  drafter?: Drafter;
  /** How many wordings to ask for. The gate picks the first that clears. */
  candidates?: number;
  /** Extra markets to re-scan a draft against, beyond each finding's own. */
  jurisdictions?: Jurisdiction[];
  /** Widen the context a draft is checked against for reused figures. */
  contextFor?: (mark: Mark) => string;
};

/** Every rule on this mark, deduplicated, in the order the notes show them. */
const ruleIdsOf = (mark: Mark) => [...new Set(mark.findings.map((f) => f.ruleId))];

/**
 * One draft against every rule on the mark.
 *
 * All of them, not the strongest: a phrase that stops tripping the ECGT but
 * still trips the Green Guides has moved the problem across the Atlantic.
 */
function gate(
  draft: string,
  mark: Mark,
  context: string,
  jurisdictions: Jurisdiction[] | undefined,
): { ok: true } | { ok: false; code: RejectionCode; reason: string } {
  for (const finding of mark.findings) {
    const verdict = validateRewrite({
      claim: mark.text,
      rewrite: draft,
      finding,
      context,
      jurisdictions,
    });
    if (!verdict.ok) return verdict;
  }
  return { ok: true };
}

/**
 * A rewrite for one mark, or an honest account of why there is none.
 *
 * The mechanical path is tried first and still goes through the gate. That is
 * not ceremony: an exact fix can still be wrong in context — appending "where
 * facilities exist" to a sentence that already said it, or swapping a verb in
 * copy where the swap reads as nonsense — and the gate is cheap.
 */
export async function rewriteMark(
  mark: Mark,
  context: string,
  options: RewriteOptions = {},
): Promise<MarkOutcome> {
  const ruleIds = ruleIdsOf(mark);
  const rejected: Rewrite["rejected"] = [];

  const mechanical = mark.findings
    .map((finding) => mechanicalRewrite(finding, mark.text))
    .find((draft): draft is string => draft !== null);

  if (mechanical) {
    const verdict = gate(mechanical, mark, context, options.jurisdictions);
    if (verdict.ok) {
      return { ok: true, rewrite: { claim: mark.text, text: mechanical, source: "mechanical", ruleIds, rejected } };
    }
    rejected.push({ text: mechanical, ...verdict });
  }

  if (!options.drafter) {
    return {
      ok: false,
      miss: {
        claim: mark.text,
        ruleIds,
        reason: mechanical
          ? "the exact fix did not clear the gate, and no drafter was configured"
          : "no exact fix for these rules, and no drafter was configured",
        rejected,
      },
    };
  }

  let drafts: string[] = [];
  try {
    drafts = await options.drafter({
      claim: mark.text,
      context,
      findings: mark.findings,
      candidates: options.candidates ?? DEFAULT_CANDIDATES,
    });
  } catch (error) {
    return {
      ok: false,
      miss: {
        claim: mark.text,
        ruleIds,
        reason: `the drafter failed: ${error instanceof Error ? (error.message.split("\n")[0] ?? "unknown") : "unknown"}`,
        rejected,
      },
    };
  }

  for (const draft of drafts) {
    const verdict = gate(draft, mark, context, options.jurisdictions);
    if (verdict.ok) {
      return { ok: true, rewrite: { claim: mark.text, text: draft, source: "model", ruleIds, rejected } };
    }
    rejected.push({ text: draft, ...verdict });
  }

  return {
    ok: false,
    miss: {
      claim: mark.text,
      ruleIds,
      reason:
        drafts.length === 0
          ? "the drafter returned nothing"
          : `all ${drafts.length} drafts were rejected`,
      rejected,
    },
  };
}

export type RewriteRun = {
  /** Keyed by `rewriteKey(finding)` — the shape `resultPage` takes. */
  rewrites: Record<string, string>;
  /** One entry per mark that got one, for reporting. */
  accepted: Rewrite[];
  /** One entry per mark that did not, with the reason. */
  missed: NoRewrite[];
};

/**
 * Sentence around a span, for voice and for figures the brand already
 * published. Falls back to the whole document when there is no sentence break,
 * which is the safe direction: the fabrication check gets more to compare
 * against, never less.
 */
export function contextAround(text: string, start: number, end: number, window = 400): string {
  const from = Math.max(0, start - window);
  const to = Math.min(text.length, end + window);
  const slice = text.slice(from, to);
  return slice.trim();
}

/**
 * Every mark on a page, drafted in order.
 *
 * Sequential rather than parallel, and deliberately: a founder running the
 * kill test is doing thirty pages, each with a handful of marks, and firing
 * every mark at the API at once is a burst of requests for a document nobody
 * is waiting on in real time.
 */
export async function rewriteAll(
  text: string,
  marks: Mark[],
  options: RewriteOptions = {},
): Promise<RewriteRun> {
  const rewrites: Record<string, string> = {};
  const accepted: Rewrite[] = [];
  const missed: NoRewrite[] = [];

  for (const mark of marks) {
    const context = options.contextFor?.(mark) ?? contextAround(text, mark.span.start, mark.span.end);
    const outcome = await rewriteMark(mark, context, options);
    if (outcome.ok) {
      accepted.push(outcome.rewrite);
      // The same accepted wording answers every finding on the mark, so it is
      // filed under each of their keys — which is what the card looks up.
      for (const finding of mark.findings) rewrites[rewriteKey(finding)] = outcome.rewrite.text;
    } else {
      missed.push(outcome.miss);
    }
  }

  return { rewrites, accepted, missed };
}

/** Convenience for a caller holding findings rather than marks. */
export function keyFor(finding: Finding): string {
  return rewriteKey(finding);
}
