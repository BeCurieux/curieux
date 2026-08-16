/**
 * Compare mode.
 *
 * BRIEF.md §9 calls this a defining product feature and §28 makes "Compare is
 * frequently used" a scale signal. §10 explains why it exists in place of the
 * obvious alternative:
 *
 * > V1 should not automatically recommend a specific substitute unless product
 * > data is trustworthy and verified. Otherwise the product creates a second
 * > hallucination surface: Product X is bad → buy Product Y.
 *
 * So the app never names a product it has not read. It compares two labels the
 * user photographed, against rules the user wrote, and every reason it gives is
 * a count of things already on screen. There is nothing here to hallucinate.
 */

import type { Verdict } from "@/lib/schema";

export type Comparison = {
  a: Verdict;
  b: Verdict;
  /**
   * Which label fits the rules better, or null when there is no honest answer
   * — either they are genuinely level, or one of them could not be read well
   * enough to compare.
   */
  winner: "a" | "b" | null;
  /** §9's "Why:" list. Every line is a fact about the two verdicts. */
  reasons: string[];
  /** Present when `winner` is null and the reason is a bad photograph. */
  blockedBy: string | null;
};

/**
 * Compare two verdicts computed against the same rule set.
 *
 * The tie-break order matters and is deliberately the order §9 prints:
 * blockers, then flagged ingredients, then uncertain ones, then the percentage.
 * Blockers first because §8 says a blocker overrides the score — a product with
 * a higher percentage and a blocker has not won, and a comparison that said it
 * had would be the feature actively misleading somebody in a supermarket aisle.
 */
export function compare(a: Verdict, b: Verdict): Comparison {
  if (a.ruleSetId !== b.ruleSetId) {
    throw new Error(
      `compare() needs both labels checked against the same rules — got "${a.ruleSetId}" and "${b.ruleSetId}"`,
    );
  }

  // §17 Rule 2. If either label could not be read, there is no comparison to
  // make, and inventing one from partial text is exactly the confident wrong
  // answer this whole design avoids.
  if (a.match === null || b.match === null) {
    const which = a.match === null && b.match === null ? "Neither label" : a.match === null ? "The first label" : "The second label";
    return {
      a,
      b,
      winner: null,
      reasons: [],
      blockedBy: `${which} could be read well enough to compare. Retake the photo and try again.`,
    };
  }

  /**
   * The tie-break, in the order §9 prints its "Why:" list.
   *
   * Blockers first because §8 says a blocker overrides the score — a product
   * with a higher percentage and a blocker has not won, and a comparison that
   * said otherwise would actively mislead somebody standing in an aisle.
   */
  const tests: { a: number; b: number; phrase: (fewer: string) => string }[] = [
    {
      a: a.blockers.length,
      b: b.blockers.length,
      phrase: (fewer) =>
        a.blockers.length === 0 || b.blockers.length === 0
          ? `${fewer} has nothing on your avoid list`
          : `${fewer} has fewer ingredients on your avoid list`,
    },
    { a: a.flags.length, b: b.flags.length, phrase: (fewer) => `${fewer} has fewer flagged ingredients` },
    {
      a: a.uncertain.length,
      b: b.uncertain.length,
      phrase: (fewer) => `${fewer} has fewer ingredients we can't fully check`,
    },
  ];

  let winner: "a" | "b" | null = null;
  for (const test of tests) {
    if (test.a === test.b) continue;
    winner = test.a < test.b ? "a" : "b";
    break;
  }
  if (winner === null && a.match !== b.match) winner = a.match > b.match ? "a" : "b";

  // Every reason the winner won, not only the one that decided it. §9's example
  // lists three, and a single line reads like a coin toss rather than a
  // comparison — the point of the feature is showing the working.
  const reasons: string[] = [];
  if (winner === null) {
    reasons.push("These two match your rules equally well");
  } else {
    const winnerName = name(winner, a, b);
    for (const test of tests) {
      const [mine, theirs] = winner === "a" ? [test.a, test.b] : [test.b, test.a];
      if (mine < theirs) reasons.push(test.phrase(winnerName));
    }
    const winnerMatch = winner === "a" ? a.match : b.match;
    const loserMatch = winner === "a" ? b.match : a.match;
    if (winnerMatch > loserMatch) reasons.push(`${winnerName} matches more of your rules overall`);

    // What the loser also does well. §13 — this is not a competition between
    // brands, it is one person choosing, and a list of nothing but faults reads
    // as a verdict on the product rather than a fit with the rules.
    const loser = winner === "a" ? b : a;
    if (loser.blockers.length === 0) {
      reasons.push(`${name(winner === "a" ? "b" : "a", a, b)} also has nothing on your avoid list`);
    }
  }

  return { a, b, winner, reasons, blockedBy: null };
}

function name(which: "a" | "b", a: Verdict, b: Verdict): string {
  const verdict = which === "a" ? a : b;
  return verdict.productName ?? (which === "a" ? "The first one" : "The second one");
}

/** §9's headline: "A fits your rules better". */
export function comparisonHeadline(comparison: Comparison): string {
  if (comparison.blockedBy) return "We can't compare these two";
  if (comparison.winner === null) return "These match your rules equally well";
  return `${name(comparison.winner, comparison.a, comparison.b)} fits your rules better`;
}
