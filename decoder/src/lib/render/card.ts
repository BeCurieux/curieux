/**
 * The cards, as SVG.
 *
 * BRIEF.md §11 makes the share card a core acquisition mechanism, §22 needs
 * realistic mock-ups to test four hypotheses before anything is built, and §32
 * describes the personality these have to carry:
 *
 * > smart friend in the supermarket … bold, clean, slightly playful, high
 * > contrast, excellent typography … warm rather than clinical
 * > The hero interface should make the result understandable from arm's length.
 *
 * ## Why warm cream and not a dark alert screen
 *
 * An earlier pass rendered these near-black with a red score, which looked
 * dramatic and was the wrong product: §32 rules out looking medical and §13
 * rules out fear-driven wellness, and a dark screen with a red number is
 * exactly the visual language of both. Cream, ink and a green that is used as
 * often as the red is what "translator, not judge" looks like.
 *
 * ## The layout rule that is not negotiable
 *
 * §8: *blockers override scores.* When a rule the user wrote has actually
 * matched — and above all when a declared allergen has — that goes above the
 * percentage, in the largest treatment on the card. The number is what people
 * screenshot, so the number must never be the most reassuring thing on a card
 * that has something to say.
 */

import type { Comparison } from "@/lib/verdict/compare";
import type { AllergenNotice, Finding, Verdict } from "@/lib/schema";
import { TAGLINE, WORDMARK } from "@/lib/brand";
import {
  ALLERGEN_PREAMBLE,
  MATCH_FOOTNOTE,
  allergenDetail,
  allergenHeading,
  allergenSentence,
  clearSentence,
  confidenceWord,
  incompleteBanner,
  matchHeadline,
} from "@/lib/verdict/language";
import { comparisonHeadline } from "@/lib/verdict/compare";
import { escapeXml, measure, wrap } from "@/lib/render/text";

/* -------------------------------------------------------------------------- */
/* Ink                                                                         */
/* -------------------------------------------------------------------------- */

const INK = {
  bg: "#FBF6EE",
  panel: "#F2E8D9",
  panelWarn: "#FBE3DC",
  ink: "#1A1613",
  muted: "#6E655C",
  faint: "#A0968B",
  hairline: "#E2D6C4",
  blocker: "#C63B26",
  flag: "#B67512",
  clear: "#2C7350",
} as const;

const FONT = "'Helvetica Neue', Helvetica, Inter, system-ui, -apple-system, Arial, sans-serif";

const OUTCOME_COLOUR: Record<Finding["outcome"], string> = {
  blocker: INK.blocker,
  flag: INK.flag,
  uncertain: INK.flag,
  clear: INK.clear,
};

/**
 * The percentage's colour.
 *
 * Bands are wide and there are only three, because §32 wants a result readable
 * from arm's length and a six-step gradient is not. A high percentage is green
 * whether or not there is a blocker — the blocker has its own, larger place on
 * the card, and colouring the number for it would be saying the same thing
 * twice while making the number mean two things.
 */
function matchColour(match: number | null): string {
  if (match === null) return INK.flag;
  if (match >= 80) return INK.clear;
  if (match >= 50) return INK.flag;
  return INK.blocker;
}

/* -------------------------------------------------------------------------- */
/* Primitives                                                                  */
/* -------------------------------------------------------------------------- */

type TextOptions = {
  size: number;
  fill: string;
  weight?: number;
  anchor?: "start" | "middle" | "end";
  letterSpacing?: number;
};

function text(x: number, y: number, content: string, o: TextOptions): string {
  const attrs = [
    `x="${x}"`,
    `y="${y}"`,
    `font-family="${FONT}"`,
    `font-size="${o.size}"`,
    `font-weight="${o.weight ?? 400}"`,
    `fill="${o.fill}"`,
    o.anchor ? `text-anchor="${o.anchor}"` : "",
    o.letterSpacing ? `letter-spacing="${o.letterSpacing}"` : "",
  ]
    .filter(Boolean)
    .join(" ");
  return `<text ${attrs}>${escapeXml(content)}</text>`;
}

function block(
  x: number,
  y: number,
  content: string,
  width: number,
  o: TextOptions & { lineHeight?: number; maxLines?: number },
): { svg: string; height: number } {
  const lineHeight = o.lineHeight ?? o.size * 1.42;
  const lines = wrap(content, width, o.size, o.maxLines ?? Infinity);
  return {
    svg: lines.map((line, i) => text(x, y + i * lineHeight, line, o)).join(""),
    height: lines.length * lineHeight,
  };
}

function rect(x: number, y: number, w: number, h: number, fill: string, radius = 0): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}"/>`;
}

function dot(cx: number, cy: number, r: number, fill: string): string {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`;
}

function chip(x: number, y: number, label: string, fill: string, ink: string, size = 26): { svg: string; width: number } {
  const padding = 22;
  // `measure` errs low, which is safe for wrapping — a line breaks early — and
  // unsafe here, where the text escapes the pill it is meant to sit inside.
  const width = measure(label, size) * 1.08 + padding * 2;
  const height = size + 22;
  return {
    svg:
      rect(x, y, width, height, fill, height / 2) +
      text(x + padding, y + height / 2 + size * 0.36, label, { size, fill: ink, weight: 600 }),
    width,
  };
}

function wordmark(x: number, y: number): string {
  return (
    text(x, y, WORDMARK, { size: 28, fill: INK.ink, weight: 800, letterSpacing: 4 }) +
    text(x + measure(WORDMARK, 28) + 4 * WORDMARK.length + 18, y, TAGLINE, { size: 26, fill: INK.faint })
  );
}

function document(width: number, height: number, body: string): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    rect(0, 0, width, height, INK.bg),
    body,
    `</svg>`,
  ].join("");
}

/* -------------------------------------------------------------------------- */
/* Sections                                                                    */
/* -------------------------------------------------------------------------- */

function bannerSection(verdict: Verdict, x: number, y: number, width: number): { svg: string; height: number } {
  const banner = incompleteBanner(verdict);
  if (!banner) return { svg: "", height: 0 };
  const padding = 28;
  const body = block(x + padding, y + padding + 26, banner, width - padding * 2, {
    size: 28,
    fill: INK.ink,
    weight: 600,
    lineHeight: 38,
  });
  const height = body.height + padding * 2;
  return { svg: rect(x, y, width, height, INK.panelWarn, 20) + body.svg, height: height + 26 };
}

/**
 * The allergen band, when something is actually listed.
 *
 * §8 shows this taking over the screen from the score, and it renders above
 * everything for that reason. The `not-listed-in-what-we-read` and
 * `cannot-check` states get the quieter block further down — they are still
 * always shown, because §17 Rule 1 turns on absence never being reported as
 * safety, but they are not the headline.
 */
function allergenAlert(notices: AllergenNotice[], x: number, y: number, width: number): { svg: string; height: number } {
  const listed = notices.filter((n) => n.state === "listed");
  if (listed.length === 0) return { svg: "", height: 0 };

  const padding = 32;
  let cursor = y + padding;
  let inner = "";

  for (const notice of listed) {
    const heading = block(x + padding, cursor + 44, allergenHeading(notice), width - padding * 2, {
      size: 48,
      fill: INK.blocker,
      weight: 800,
      lineHeight: 58,
    });
    inner += heading.svg;
    cursor += 44 + heading.height - 10;

    const detail = allergenDetail(notice);
    if (detail) {
      const line = block(x + padding, cursor + 28, detail, width - padding * 2, {
        size: 28,
        fill: INK.ink,
        weight: 600,
        lineHeight: 38,
      });
      inner += line.svg;
      cursor += 28 + line.height - 6;
    }
  }

  const preamble = block(x + padding, cursor + 26, ALLERGEN_PREAMBLE, width - padding * 2, {
    size: 26,
    fill: INK.ink,
    lineHeight: 35,
  });
  cursor += 26 + preamble.height;

  const height = cursor - y + padding;
  return {
    svg: rect(x, y, width, height, INK.panelWarn, 24) + rect(x, y, 8, height, INK.blocker, 4) + inner + preamble.svg,
    height: height + 30,
  };
}

/** The quieter block: every allergen rule the user set, on every scan. */
function allergenLedger(notices: AllergenNotice[], x: number, y: number, width: number): { svg: string; height: number } {
  const rest = notices.filter((n) => n.state !== "listed");
  if (rest.length === 0) return { svg: "", height: 0 };

  const padding = 28;
  let cursor = y + padding;
  let inner = text(x + padding, cursor + 24, "WHAT YOU ASKED US TO WATCH FOR", {
    size: 23,
    fill: INK.muted,
    weight: 700,
    letterSpacing: 2.2,
  });
  cursor += 24 + 22;

  for (const notice of rest) {
    inner += dot(x + padding + 8, cursor + 12, 8, notice.state === "cannot-check" ? INK.flag : INK.faint);
    const line = block(x + padding + 32, cursor + 20, allergenSentence(notice), width - padding * 2 - 32, {
      size: 28,
      fill: INK.ink,
      weight: 500,
      lineHeight: 37,
    });
    inner += line.svg;
    cursor += line.height + 12;
  }

  const preamble = block(x + padding, cursor + 16, ALLERGEN_PREAMBLE, width - padding * 2, {
    size: 24,
    fill: INK.muted,
    lineHeight: 32,
  });
  cursor += 16 + preamble.height;

  const height = cursor - y + padding;
  return { svg: rect(x, y, width, height, INK.panel, 22) + inner + preamble.svg, height: height + 28 };
}

function matchSection(verdict: Verdict, x: number, y: number, width: number): { svg: string; height: number } {
  const colour = matchColour(verdict.match);
  let svg = "";
  let cursor: number;

  if (verdict.match === null) {
    // Set as words rather than as a giant dash: a dash at this size reads as a
    // stray rule, and the one state that cannot afford to look like a rendering
    // glitch is the one where the product is declining to answer.
    svg += text(x, y + 92, "NO MATCH SCORE", { size: 84, fill: colour, weight: 800, letterSpacing: -1 });
    cursor = y + 118;
  } else {
    const glyph = `${verdict.match}%`;
    svg += text(x, y + 150, glyph, { size: 200, fill: colour, weight: 800, letterSpacing: -8 });
    svg += text(x + measure(glyph, 200) + 18, y + 150, "MATCH", { size: 52, fill: INK.muted, weight: 700 });
    cursor = y + 186;
  }

  const headline = block(x, cursor + 46, matchHeadline(verdict), width, {
    size: 44,
    fill: INK.ink,
    weight: 700,
    lineHeight: 56,
  });
  svg += headline.svg;
  cursor += 46 + headline.height;

  // §4: a verdict with no rules beside it is the thing this product replaces.
  const set = chip(x, cursor + 10, `checked against: ${verdict.ruleSetLabel}`, INK.panel, INK.ink);
  svg += set.svg;
  cursor += 10 + 48;

  return { svg, height: cursor - y + 30 };
}

/**
 * Findings, until the space runs out.
 *
 * `maxY` rather than a count, because a count cannot know how tall a finding
 * is — a one-word ingredient with a short rule and a three-line ingredient with
 * an uncertainty note differ by a factor of three. Blockers are passed first,
 * so what gets dropped is always the least consequential thing on the label,
 * and the number dropped is said out loud.
 */
function findingSection(
  findings: Finding[],
  x: number,
  y: number,
  width: number,
  maxY: number,
): { svg: string; height: number } {
  let cursor = y;
  let svg = "";
  let rendered = 0;
  const MORE_LINE = 48;

  for (const finding of findings) {
    let local = cursor;
    let piece = dot(x + 10, local + 16, 10, OUTCOME_COLOUR[finding.outcome]);

    const name = block(x + 38, local + 28, finding.ingredient, width - 38, {
      size: 36,
      fill: INK.ink,
      weight: 700,
      lineHeight: 46,
      maxLines: 2,
    });
    piece += name.svg;
    local += name.height + 4;

    // §16's "Why you're seeing this" — always the user's own rule, never the
    // app's opinion.
    const because = block(x + 38, local + 26, finding.because, width - 38, {
      size: 28,
      fill: INK.muted,
      lineHeight: 37,
      maxLines: 3,
    });
    piece += because.svg;
    local += 26 + because.height;

    // §8 prints "High confidence" / "Limited information" under each line, and
    // it is about whether the *label* said enough — never merged with how well
    // the camera read it, which is a different question with a different fix.
    const meta: string[] = [confidenceWord(finding)];
    if (finding.readConfidence < 0.9) meta.push(`read ${Math.round(finding.readConfidence * 100)}% sure`);
    if (finding.evidence[0]) meta.push(finding.evidence[0].body);
    piece += text(x + 38, local + 30, meta.join("  ·  "), { size: 23, fill: INK.faint });
    local += 30 + 26;

    const remaining = findings.length - rendered - 1;
    if (local + (remaining > 0 ? MORE_LINE : 0) > maxY && rendered > 0) break;

    piece += `<line x1="${x}" y1="${local}" x2="${x + width}" y2="${local}" stroke="${INK.hairline}" stroke-width="2"/>`;
    local += 26;

    svg += piece;
    cursor = local;
    rendered += 1;
  }

  const hidden = findings.length - rendered;
  if (hidden > 0) {
    svg += text(x, cursor + 28, `+ ${hidden} more in the app`, { size: 27, fill: INK.muted, weight: 600 });
    cursor += 48;
  }

  return { svg, height: cursor - y };
}

function noteSection(verdict: Verdict, x: number, y: number, width: number): { svg: string; height: number } {
  if (verdict.notes.length === 0) return { svg: "", height: 0 };
  const padding = 28;
  let cursor = y + padding;
  let inner = text(x + padding, cursor + 24, "WHAT THIS LABEL DOESN'T SAY", {
    size: 23,
    fill: INK.muted,
    weight: 700,
    letterSpacing: 2.2,
  });
  cursor += 24 + 20;

  for (const note of verdict.notes) {
    const line = block(x + padding, cursor + 22, note, width - padding * 2, {
      size: 26,
      fill: INK.ink,
      lineHeight: 35,
    });
    inner += line.svg;
    cursor += 22 + line.height - 8;
  }

  const height = cursor - y + padding;
  return { svg: rect(x, y, width, height, INK.panel, 22) + inner, height: height + 26 };
}

/* -------------------------------------------------------------------------- */
/* The cards                                                                   */
/* -------------------------------------------------------------------------- */

const W = 1080;
const H = 1920;
const M = 76;
const WIDTH = W - M * 2;

/** §8 Step 3 — the result screen. 9:16, so it doubles as the film asset. */
export function matchCard(verdict: Verdict): string {
  let y = 100;
  let svg = wordmark(M, y);
  y += 54;

  if (verdict.productName) {
    const name = block(M, y + 34, verdict.productName, WIDTH, {
      size: 34,
      fill: INK.muted,
      weight: 600,
      lineHeight: 44,
      maxLines: 2,
    });
    svg += name.svg;
    y += 34 + name.height - 8;
  }

  // §8: a declared allergen takes over from the score.
  const alert = allergenAlert(verdict.allergens, M, y, WIDTH);
  svg += alert.svg;
  y += alert.height;

  const banner = bannerSection(verdict, M, y, WIDTH);
  svg += banner.svg;
  y += banner.height;

  const score = matchSection(verdict, M, y, WIDTH);
  svg += score.svg;
  y += score.height;

  const ledger = allergenLedger(verdict.allergens, M, y, WIDTH);
  svg += ledger.svg;
  y += ledger.height;

  const clearText = clearSentence(verdict.clearCount, verdict.readComplete);
  const clearHeight = clearText ? 62 : 0;
  const noteHeight = noteSection(verdict, M, 0, WIDTH).height;

  // Blockers first, then flags, then uncertainty — the order §8 prints them and
  // the order they get dropped in when space runs out.
  const ordered = [...verdict.blockers, ...verdict.flags, ...verdict.uncertain];
  const findings = findingSection(ordered, M, y, WIDTH, H - 200 - noteHeight - clearHeight);
  svg += findings.svg;
  y += findings.height;

  if (clearText) {
    svg += dot(M + 10, y + 16, 10, INK.clear);
    svg += text(M + 38, y + 26, clearText, { size: 29, fill: INK.muted });
    y += clearHeight;
  }

  svg += noteSection(verdict, M, y, WIDTH).svg;

  const footnote = block(M, H - 150, MATCH_FOOTNOTE, WIDTH, { size: 24, fill: INK.faint, lineHeight: 33 });
  svg += footnote.svg;
  svg += text(M, H - 58, `${verdict.provenance.engineVersion} · ${verdict.provenance.knowledgeVersion}`, {
    size: 20,
    fill: INK.hairline,
  });

  return document(W, H, svg);
}

/**
 * §11's share card. 9:16, and tuned for a feed rather than a hand.
 *
 * Louder and shorter than the result screen: the score, the rules it was
 * checked against, and the top findings. What it must never lose at any size is
 * the allergen alert and the incomplete banner, because those are the parts
 * that stop it being a confident lie in somebody else's timeline.
 */
export function shareCard(verdict: Verdict): string {
  let y = 110;
  let svg = text(M, y, "I SCANNED THIS", { size: 40, fill: INK.ink, weight: 800, letterSpacing: 3 });
  y += 40;

  if (verdict.productName) {
    const name = block(M, y + 40, verdict.productName, WIDTH, {
      size: 38,
      fill: INK.muted,
      weight: 600,
      lineHeight: 48,
      maxLines: 2,
    });
    svg += name.svg;
    y += 40 + name.height;
  }

  const alert = allergenAlert(verdict.allergens, M, y, WIDTH);
  svg += alert.svg;
  y += alert.height;

  const banner = bannerSection(verdict, M, y, WIDTH);
  svg += banner.svg;
  y += banner.height;

  const colour = matchColour(verdict.match);
  if (verdict.match === null) {
    svg += text(M, y + 100, "NO MATCH SCORE", { size: 88, fill: colour, weight: 800 });
    y += 130;
  } else {
    const glyph = `${verdict.match}%`;
    svg += text(M, y + 190, glyph, { size: 250, fill: colour, weight: 800, letterSpacing: -10 });
    svg += text(M + measure(glyph, 250) + 20, y + 190, "MATCH\nFOR ME".split("\n")[0]!, {
      size: 56,
      fill: INK.muted,
      weight: 700,
    });
    y += 232;
  }

  const headline = block(M, y + 46, matchHeadline(verdict), WIDTH, {
    size: 46,
    fill: INK.ink,
    weight: 700,
    lineHeight: 58,
    maxLines: 2,
  });
  svg += headline.svg;
  y += 46 + headline.height + 30;

  // "My rules:" — §11's card lists them, and it is the whole point of the
  // format: the verdict is only interesting because it belongs to somebody.
  svg += text(M, y + 26, "MY RULES", { size: 24, fill: INK.muted, weight: 700, letterSpacing: 2.4 });
  y += 26 + 22;
  const setChip = chip(M, y, verdict.ruleSetLabel, INK.panel, INK.ink, 30);
  svg += setChip.svg;
  y += 74;

  /**
   * The quiet allergen states go on the share card too, and this is not
   * padding.
   *
   * A card reading "96% MATCH · my rules: watching for peanuts" with no
   * qualifier says *no peanuts* to everyone who sees it — in somebody else's
   * feed, to a reader who did not take the photograph and cannot check. §17
   * Rule 1 is that absence from OCR is not proof of absence, and the share card
   * is the surface where that claim travels furthest from the person who could
   * verify it.
   */
  const ledger = allergenLedger(verdict.allergens, M, y, WIDTH);
  svg += ledger.svg;
  y += ledger.height;

  const ordered = [...verdict.blockers, ...verdict.flags, ...verdict.uncertain];
  svg += findingSection(ordered, M, y, WIDTH, H - 190).svg;

  svg += text(M, H - 100, MATCH_FOOTNOTE.split(".")[0]! + ".", { size: 24, fill: INK.faint });
  svg += wordmark(M, H - 50);

  return document(W, H, svg);
}

/**
 * §9 and §11's Compare card — "WHICH ONE WON?"
 *
 * §9 suspects this may be more viral than the single scan, and it is the one
 * format where the app's answer is genuinely non-obvious before you see it.
 */
export function compareCard(comparison: Comparison): string {
  const { a, b } = comparison;
  let y = 110;
  let svg = text(M, y, "WHICH ONE FITS ME?", { size: 46, fill: INK.ink, weight: 800, letterSpacing: 2 });
  y += 60;

  const column = (verdict: Verdict, top: number, isWinner: boolean): { svg: string; height: number } => {
    const padding = 32;
    let cursor = top + padding;
    let inner = "";

    const name = block(M + padding, cursor + 36, verdict.productName ?? "This one", WIDTH - padding * 2, {
      size: 36,
      fill: INK.ink,
      weight: 700,
      lineHeight: 46,
      maxLines: 2,
    });
    inner += name.svg;
    cursor += 36 + name.height - 6;

    const glyph = verdict.match === null ? "—" : `${verdict.match}%`;
    inner += text(M + padding, cursor + 112, glyph, {
      size: 132,
      fill: matchColour(verdict.match),
      weight: 800,
      letterSpacing: -5,
    });
    cursor += 132;

    const summary = [
      verdict.blockers.length === 0
        ? "Nothing on your avoid list"
        : `${verdict.blockers.length} on your avoid list`,
      `${verdict.flags.length + verdict.uncertain.length} to know about`,
    ].join("  ·  ");
    inner += text(M + padding, cursor + 34, summary, { size: 28, fill: INK.muted, weight: 500 });
    cursor += 34;

    const height = cursor - top + padding;
    return {
      svg:
        rect(M, top, WIDTH, height, isWinner ? INK.panel : INK.bg, 24) +
        (isWinner ? rect(M, top, 8, height, INK.clear, 4) : rect(M, top, WIDTH, height, "none", 24).replace('fill="none"', `fill="none" stroke="${INK.hairline}" stroke-width="2"`)) +
        inner,
      height: height + 24,
    };
  };

  const first = column(a, y, comparison.winner === "a");
  svg += first.svg;
  y += first.height;

  svg += text(M + WIDTH / 2, y + 42, "vs", { size: 34, fill: INK.faint, weight: 700, anchor: "middle" });
  y += 62;

  const second = column(b, y, comparison.winner === "b");
  svg += second.svg;
  y += second.height + 20;

  const headline = block(M, y + 50, comparisonHeadline(comparison), WIDTH, {
    size: 48,
    fill: INK.ink,
    weight: 800,
    lineHeight: 60,
    maxLines: 2,
  });
  svg += headline.svg;
  y += 50 + headline.height + 16;

  if (comparison.blockedBy) {
    svg += block(M, y + 30, comparison.blockedBy, WIDTH, { size: 28, fill: INK.muted, lineHeight: 38 }).svg;
  } else {
    for (const reason of comparison.reasons.slice(0, 4)) {
      svg += dot(M + 10, y + 20, 9, INK.clear);
      const line = block(M + 38, y + 30, reason, WIDTH - 38, { size: 28, fill: INK.ink, lineHeight: 38, maxLines: 2 });
      svg += line.svg;
      y += line.height + 18;
    }
  }

  svg += text(M, H - 108, `Checked against: ${a.ruleSetLabel}`, { size: 26, fill: INK.muted, weight: 600 });
  svg += wordmark(M, H - 54);

  return document(W, H, svg);
}

/**
 * §12 Creative 2 — the same packet, two people, two verdicts.
 *
 * §4 calls this "the product's key demonstration" and asks for it throughout
 * the product and the marketing, so it gets a card of its own rather than being
 * assembled by hand for each video.
 */
export function twoPeopleCard(left: Verdict, right: Verdict): string {
  if (left.productName !== right.productName) {
    throw new Error("twoPeopleCard compares one product against two rule sets — the products differ");
  }

  let y = 110;
  let svg = text(M, y, "SAME PACKET.", { size: 52, fill: INK.ink, weight: 800, letterSpacing: 1 });
  y += 60;
  svg += text(M, y, "DIFFERENT PEOPLE.", { size: 52, fill: INK.ink, weight: 800, letterSpacing: 1 });
  y += 46;

  if (left.productName) {
    const name = block(M, y + 40, left.productName, WIDTH, {
      size: 32,
      fill: INK.muted,
      weight: 600,
      lineHeight: 42,
      maxLines: 2,
    });
    svg += name.svg;
    y += 40 + name.height + 20;
  }

  const half = (verdict: Verdict, top: number): number => {
    const padding = 36;
    let cursor = top + padding;
    let inner = "";

    const rules = block(M + padding, cursor + 34, verdict.ruleSetLabel, WIDTH - padding * 2, {
      size: 32,
      fill: INK.muted,
      weight: 600,
      lineHeight: 42,
      maxLines: 2,
    });
    inner += rules.svg;
    cursor += 34 + rules.height + 6;

    const glyph = verdict.match === null ? "—" : `${verdict.match}%`;
    inner += text(M + padding, cursor + 128, glyph, {
      size: 152,
      fill: matchColour(verdict.match),
      weight: 800,
      letterSpacing: -6,
    });

    const summary =
      verdict.blockers.length === 0
        ? "No blockers"
        : verdict.blockers.length === 1
          ? "1 blocker"
          : `${verdict.blockers.length} blockers`;
    inner += text(M + padding + measure(glyph, 152) + 24, cursor + 128, summary, {
      size: 34,
      fill: INK.ink,
      weight: 700,
    });
    // The number's own baseline plus a gap: without it the first named blocker
    // sits under the descender and the two read as one line.
    cursor += 128 + 24;

    // The named blockers are what make this shareable. "38%" is a number
    // somebody scrolls past; "38% — because of the whey protein" is the thing
    // they send to the person they live with, which is the entire point of
    // §12's Creative 2.
    for (const blocker of verdict.blockers.slice(0, 2)) {
      inner += dot(M + padding + 8, cursor + 26, 8, INK.blocker);
      const line = block(M + padding + 32, cursor + 34, blocker.ingredient, WIDTH - padding * 2 - 32, {
        size: 28,
        fill: INK.ink,
        weight: 500,
        lineHeight: 36,
        maxLines: 1,
      });
      inner += line.svg;
      cursor += 34 + line.height - 6;
    }
    if (verdict.blockers.length === 0) {
      inner += text(M + padding, cursor + 34, "Nothing on their avoid list", { size: 28, fill: INK.muted });
      cursor += 34;
    }

    const height = cursor - top + padding;
    svg += rect(M, top, WIDTH, height, INK.panel, 24) + inner;
    return height + 28;
  };

  y += half(left, y);
  y += half(right, y);

  // Pinned rather than flowed, so the closing line lands in the same place
  // whatever the two rule sets turned up.
  const line = block(M, H - 300, "Same food. Totally different result.", WIDTH, {
    size: 52,
    fill: INK.ink,
    weight: 800,
    lineHeight: 64,
  });
  svg += line.svg;
  svg += block(M, H - 180, "Tell it what you don't eat. Then just scan stuff.", WIDTH, {
    size: 30,
    fill: INK.muted,
    lineHeight: 40,
  }).svg;

  svg += wordmark(M, H - 60);
  return document(W, H, svg);
}
