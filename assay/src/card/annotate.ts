/**
 * The copy, marked up.
 *
 * This is the idea the card is built on: rather than a list of problems beside
 * a page, show the brand *their own words* with the flagged phrases marked and
 * numbered, and put the notes underneath — a critical edition of a product
 * page. It is the right form for a product about language, it is the form a
 * founder recognises as beautiful rather than as an audit, and it is why the
 * card is worth screenshotting.
 *
 * The work here is merging. The same phrase is routinely flagged by three
 * markets at once — "eco-friendly" trips the ECGT, the Green Guides and the
 * ACCC — and marking it three times would produce a page of overlapping
 * underlines and the numbers 4, 5 and 6 stacked on one word. One mark carries
 * every finding that landed on it.
 */

import type { Finding, ScanResult, Span } from "../engine/types.js";

/** One underlined phrase, and everything the scan has to say about it. */
export type Mark = {
  /** 1-based, in reading order. This is the superscript the reader follows. */
  index: number;
  span: Span;
  text: string;
  /** Every finding whose span overlapped this one, strongest first. */
  findings: Finding[];
};

export type Piece = { kind: "text"; text: string } | { kind: "mark"; mark: Mark };

export type Annotated = {
  /** The whole document in order: plain runs and marked runs, nothing lost. */
  pieces: Piece[];
  marks: Mark[];
};

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 } as const;

function overlaps(a: Span, b: Span): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * Findings become marks: sorted by where they sit, merged where they touch,
 * numbered in reading order.
 *
 * Merging on overlap rather than on exact equality is deliberate. Two rules
 * often catch different lengths of the same phrase — one matches "proven", the
 * other "clinically proven" — and the reader is owed one underline around the
 * longer of them, not two nested ones.
 */
export function marksFor(findings: Finding[]): Mark[] {
  const sorted = [...findings].sort(
    (a, b) => a.trigger.span.start - b.trigger.span.start || b.trigger.span.end - a.trigger.span.end,
  );

  const groups: { span: Span; findings: Finding[] }[] = [];
  for (const finding of sorted) {
    const last = groups[groups.length - 1];
    if (last && overlaps(last.span, finding.trigger.span)) {
      last.span = {
        start: Math.min(last.span.start, finding.trigger.span.start),
        end: Math.max(last.span.end, finding.trigger.span.end),
      };
      last.findings.push(finding);
      continue;
    }
    groups.push({ span: { ...finding.trigger.span }, findings: [finding] });
  }

  return groups.map((group, i) => ({
    index: i + 1,
    span: group.span,
    // The strongest finding leads, because it is the one the eye should meet
    // first in the note. Ties keep document order, so the output is stable.
    findings: [...group.findings].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]),
    text: "",
  }));
}

/**
 * The document as an alternating run of plain text and marks.
 *
 * Every character of the source appears exactly once, in order. That is a
 * property the tests check rather than a hope: the card reproduces a brand's
 * copy, and copy that silently loses a sentence between two underlines is
 * worse than no card at all.
 */
export function annotate(text: string, findings: Finding[]): Annotated {
  const marks = marksFor(findings).map((mark) => ({
    ...mark,
    text: text.slice(mark.span.start, mark.span.end),
  }));

  const pieces: Piece[] = [];
  let cursor = 0;
  for (const mark of marks) {
    if (mark.span.start > cursor) {
      pieces.push({ kind: "text", text: text.slice(cursor, mark.span.start) });
    }
    pieces.push({ kind: "mark", mark });
    cursor = mark.span.end;
  }
  if (cursor < text.length) pieces.push({ kind: "text", text: text.slice(cursor) });

  return { pieces, marks };
}

export function annotateResult(text: string, result: ScanResult): Annotated {
  return annotate(text, result.findings);
}

/** The markets a mark's findings came from, deduplicated, in reading order. */
export function marketsOf(mark: Mark): string[] {
  return [...new Set(mark.findings.map((finding) => finding.jurisdiction))];
}

/**
 * The one phrase to lead the share card with: the strongest finding, and among
 * equals the first one a reader would meet.
 */
export function headlineMark(marks: Mark[]): Mark | undefined {
  return [...marks].sort((a, b) => {
    const left = a.findings[0];
    const right = b.findings[0];
    if (!left || !right) return 0;
    return SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity] || a.index - b.index;
  })[0];
}
