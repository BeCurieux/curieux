/**
 * The verdict screen and the share card, as SVG.
 *
 * BRIEF.md §6 calls the share card "the single most important screen in the
 * app" and §9 needs a result screen to film for Phase 0. Both are this file.
 *
 * ## Why SVG and not a phone
 *
 * The build order puts the renderer before the app on purpose: Phase 0 needs a
 * result screen, and a result screen does not need an App Store account. These
 * cards are mocked only in the sense that no phone runs them — the verdicts in
 * them are real, computed by the engine from real labels, because a fake door
 * that lies about the product tests a door nobody is buying.
 *
 * ## What the layout is not allowed to do
 *
 * The allergen block renders above the flags and above the fold, always, even
 * when every finding is "not flagged" — §10.1's rule is that the sentence is
 * always present, and a layout that hides it when it is boring is the same bug
 * as a verdict that omits it.
 *
 * The incomplete banner renders at the top, in the strongest treatment on the
 * card. The share card is the screen most likely to be seen by somebody who did
 * not take the photograph, and a partial read passed off as a whole one is §6's
 * kill scenario with a share button attached.
 */

import type { Flag, Verdict } from "@/lib/schema";
import {
  ALLERGEN_PREAMBLE,
  SCORE_FOOTNOTE,
  allergenSentence,
  clearedSentence,
  incompleteBanner,
  scoreHeadline,
} from "@/lib/verdict/language";
import { escapeXml, measure, wrap } from "@/lib/render/text";

const INK = {
  bg: "#0E0F12",
  panel: "#17181D",
  text: "#F5F3EF",
  muted: "#9A9AA2",
  faint: "#6E7079",
  hairline: "#2A2C33",
  red: "#FF5A4E",
  amber: "#FFA53D",
  yellow: "#FFD84D",
  ok: "#5BD79B",
} as const;

const FONT = "'Helvetica Neue', Helvetica, Inter, system-ui, -apple-system, Arial, sans-serif";

const SEVERITY_COLOUR = { red: INK.red, amber: INK.amber, yellow: INK.yellow } as const;

/** The score's own colour. Bands match `scoreHeadline`, so number and words agree. */
function scoreColour(score: number | null): string {
  if (score === null) return INK.amber;
  if (score >= 85) return INK.ok;
  if (score >= 65) return INK.yellow;
  if (score >= 40) return INK.amber;
  return INK.red;
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
  opacity?: number;
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
    o.opacity !== undefined ? `opacity="${o.opacity}"` : "",
  ]
    .filter(Boolean)
    .join(" ");
  return `<text ${attrs}>${escapeXml(content)}</text>`;
}

/** Wrapped text. Returns the markup and the height it consumed. */
function block(
  x: number,
  y: number,
  content: string,
  width: number,
  o: TextOptions & { lineHeight?: number; maxLines?: number },
): { svg: string; height: number } {
  const lineHeight = o.lineHeight ?? o.size * 1.42;
  const lines = wrap(content, width, o.size, o.maxLines ?? Infinity);
  const svg = lines.map((line, i) => text(x, y + i * lineHeight, line, o)).join("");
  return { svg, height: lines.length * lineHeight };
}

function rect(x: number, y: number, w: number, h: number, fill: string, radius = 0): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}"/>`;
}

function dot(cx: number, cy: number, r: number, fill: string): string {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`;
}

/** A rounded label chip, sized to its own text. */
function chip(x: number, y: number, label: string, fill: string, ink: string): { svg: string; width: number } {
  const size = 26;
  const padding = 20;
  // `measure` is an approximation and errs low, which is safe for wrapping —
  // a line breaks early — and unsafe here, where the text escaped the pill it
  // was supposed to sit inside. The pill pays for the error.
  const width = measure(label, size) * 1.08 + padding * 2;
  const height = 46;
  const svg =
    rect(x, y, width, height, fill, height / 2) +
    text(x + padding, y + height / 2 + size * 0.36, label, { size, fill: ink, weight: 600 });
  return { svg, width };
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
    fill: INK.bg,
    weight: 700,
    lineHeight: 38,
  });
  const height = body.height + padding * 2;
  return { svg: rect(x, y, width, height, INK.amber, 20) + body.svg, height: height + 28 };
}

function scoreSection(verdict: Verdict, x: number, y: number, width: number): { svg: string; height: number } {
  const colour = scoreColour(verdict.score);
  const numberSize = 190;
  let svg = "";

  // A withheld score occupies the same place as the number, because that is
  // where the reader is already looking — but it is set as words rather than as
  // a giant dash. A dash at 190px reads as a stray rule, and the one thing this
  // state cannot afford is to be mistaken for a rendering glitch.
  let cursor: number;
  if (verdict.score === null) {
    svg += text(x, y + 96, "NO SCORE", { size: 96, fill: colour, weight: 800, letterSpacing: -2 });
    cursor = y + 120;
  } else {
    const glyph = String(verdict.score);
    svg += text(x, y + numberSize * 0.75, glyph, {
      size: numberSize,
      fill: colour,
      weight: 800,
      letterSpacing: -6,
    });
    svg += text(x + measure(glyph, numberSize) + 14, y + numberSize * 0.75, "/100", {
      size: 52,
      fill: INK.muted,
      weight: 600,
    });
    cursor = y + numberSize * 0.95;
  }
  const headline = block(x, cursor + 44, scoreHeadline(verdict.score, verdict.category), width, {
    size: 44,
    fill: INK.text,
    weight: 700,
    lineHeight: 56,
  });
  svg += headline.svg;
  cursor += 44 + headline.height;

  // The profile is named on the card because §5's whole argument is that a
  // generic score means nothing — a number with no profile beside it is the
  // thing the product exists to replace.
  const profile = chip(x, cursor + 8, `for: ${verdict.profileLabel}`, INK.panel, INK.text);
  svg += profile.svg;
  cursor += 8 + 46;

  return { svg, height: cursor - y + 34 };
}

function allergenSection(verdict: Verdict, x: number, y: number, width: number): { svg: string; height: number } {
  if (verdict.allergens.length === 0) return { svg: "", height: 0 };

  const padding = 30;
  let cursor = y + padding;
  let inner = "";

  inner += text(x + padding, cursor + 26, "ALLERGENS ON YOUR PROFILE", {
    size: 24,
    fill: INK.muted,
    weight: 700,
    letterSpacing: 2.4,
  });
  cursor += 26 + 26;

  for (const finding of verdict.allergens) {
    const colour =
      finding.state === "flagged" ? INK.red : finding.state === "cannot-verify" ? INK.amber : INK.muted;
    inner += dot(x + padding + 9, cursor + 12, 9, colour);
    const line = block(x + padding + 34, cursor + 22, allergenSentence(finding), width - padding * 2 - 34, {
      size: 30,
      fill: finding.state === "not-flagged" ? INK.text : colour,
      weight: finding.state === "not-flagged" ? 500 : 700,
      lineHeight: 40,
    });
    inner += line.svg;
    cursor += line.height + 16;
  }

  // The preamble sits under the findings rather than over them, at full size.
  // Above, it reads as a disclaimer to scroll past; below, it reads as the
  // reason the sentences above are worded the way they are.
  const preamble = block(x + padding, cursor + 20, ALLERGEN_PREAMBLE, width - padding * 2, {
    size: 25,
    fill: INK.muted,
    lineHeight: 34,
  });
  cursor += 20 + preamble.height;

  const height = cursor - y + padding;
  return {
    svg:
      rect(x, y, width, height, INK.panel, 24) +
      rect(x, y, 6, height, INK.red, 3) +
      inner +
      preamble.svg,
    height: height + 30,
  };
}

/**
 * Flags, until the space runs out.
 *
 * `maxY` rather than a flag count, because a count cannot know how tall a flag
 * is — a one-word ingredient with a short reason and a three-line ingredient
 * with a three-line reason and a swap suggestion differ by a factor of four,
 * and a fixed limit tuned on one of them overflows on the other. The first
 * version of this took a count and ran the last flag straight through the
 * footnote.
 *
 * Flags arrive sorted by severity, so what gets dropped is always the least
 * severe thing on the label, and what is dropped is counted and said.
 */
function flagSection(
  flags: Flag[],
  x: number,
  y: number,
  width: number,
  maxY: number,
): { svg: string; height: number } {
  let cursor = y;
  let svg = "";
  let rendered = 0;

  // Reserved for the "+ N more" line, so the overflow notice cannot itself
  // overflow.
  const MORE_LINE = 48;

  for (const flag of flags) {
    // Composed against a local cursor first. Nothing is committed until the
    // whole flag is known to fit.
    let local = cursor;
    let piece = dot(x + 9, local + 15, 9, SEVERITY_COLOUR[flag.severity]);

    const name = block(x + 34, local + 26, flag.ingredient, width - 34, {
      size: 34,
      fill: INK.text,
      weight: 700,
      lineHeight: 44,
      maxLines: 2,
    });
    piece += name.svg;
    local += name.height + 4;

    const reason = block(x + 34, local + 24, flag.reason, width - 34, {
      size: 27,
      fill: INK.muted,
      lineHeight: 36,
      maxLines: 3,
    });
    piece += reason.svg;
    local += 24 + reason.height;

    // §10.3 — a red flag never renders alone.
    if (flag.lookFor) {
      const look = block(x + 34, local + 22, `Look for: ${flag.lookFor}`, width - 34, {
        size: 26,
        fill: INK.ok,
        lineHeight: 34,
        maxLines: 3,
      });
      piece += look.svg;
      local += 22 + look.height;
    }

    // Both uncertainties, side by side and never merged into one number —
    // CLAUDE.md collision 4.
    const meta: string[] = [];
    if (flag.readConfidence < 0.9) meta.push(`read ${Math.round(flag.readConfidence * 100)}% sure`);
    if (flag.strength) meta.push(strengthWord(flag.strength));
    if (flag.sources[0]) meta.push(flag.sources[0].body);
    if (meta.length > 0) {
      piece += text(x + 34, local + 30, meta.join("  ·  "), { size: 23, fill: INK.faint });
      local += 30;
    }

    local += 26;
    const remaining = flags.length - rendered - 1;
    const needed = local + (remaining > 0 ? MORE_LINE : 0);
    if (needed > maxY && rendered > 0) break;

    piece += `<line x1="${x}" y1="${local}" x2="${x + width}" y2="${local}" stroke="${INK.hairline}" stroke-width="1"/>`;
    local += 26;

    svg += piece;
    cursor = local;
    rendered += 1;
  }

  const hidden = flags.length - rendered;
  if (hidden > 0) {
    svg += text(x, cursor + 28, `+ ${hidden} more flagged in the app`, { size: 27, fill: INK.muted, weight: 600 });
    cursor += 28 + 20;
  }

  return { svg, height: cursor - y };
}

function strengthWord(strength: NonNullable<Flag["strength"]>): string {
  switch (strength) {
    case "regulatory":
      return "a labelling rule says so";
    case "established":
      return "broadly agreed";
    case "contested":
      return "evidence is contested";
    case "preference":
      return "your preference, no claim made";
  }
}

function caveatSection(verdict: Verdict, x: number, y: number, width: number): { svg: string; height: number } {
  if (verdict.caveats.length === 0) return { svg: "", height: 0 };

  const padding = 28;
  let cursor = y + padding;
  let inner = text(x + padding, cursor + 24, "WHAT THIS LABEL DOES NOT SAY", {
    size: 23,
    fill: INK.muted,
    weight: 700,
    letterSpacing: 2.2,
  });
  cursor += 24 + 22;

  for (const caveat of verdict.caveats) {
    const line = block(x + padding, cursor + 22, caveat, width - padding * 2, {
      size: 26,
      fill: INK.text,
      lineHeight: 35,
      opacity: 0.86,
    });
    inner += line.svg;
    cursor += 22 + line.height - 8;
  }

  const height = cursor - y + padding;
  return { svg: rect(x, y, width, height, INK.panel, 22) + inner, height: height + 28 };
}

/* -------------------------------------------------------------------------- */
/* The two cards                                                               */
/* -------------------------------------------------------------------------- */

function document(width: number, height: number, body: string): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    rect(0, 0, width, height, INK.bg),
    body,
    `</svg>`,
  ].join("");
}

function wordmark(x: number, y: number): string {
  return (
    text(x, y, "INGRID", { size: 26, fill: INK.text, weight: 800, letterSpacing: 5 }) +
    text(x + measure("INGRID", 26) + 5 * 6 + 16, y, "reads the label", { size: 26, fill: INK.muted })
  );
}

/**
 * 1080×1920 — the phone-shaped result screen. This is the Phase 0 film asset:
 * §7's creator holds up the packet, the screen cuts to this.
 */
export function verdictScreen(verdict: Verdict): string {
  const W = 1080;
  const H = 1920;
  const M = 72;
  const width = W - M * 2;
  let y = 96;
  let svg = wordmark(M, y);
  y += 56;

  if (verdict.productName) {
    const name = block(M, y + 34, verdict.productName, width, {
      size: 34,
      fill: INK.muted,
      weight: 600,
      lineHeight: 44,
      maxLines: 2,
    });
    svg += name.svg;
    y += 34 + name.height - 10;
  }

  const banner = bannerSection(verdict, M, y, width);
  svg += banner.svg;
  y += banner.height;

  const score = scoreSection(verdict, M, y, width);
  svg += score.svg;
  y += score.height;

  const allergens = allergenSection(verdict, M, y, width);
  svg += allergens.svg;
  y += allergens.height;

  // The caveats and the cleared line are measured before the flags are laid
  // out, so the flags can be given what is genuinely left rather than a guess.
  // Caveats outrank flags for space on purpose: "what this label does not say"
  // is the part a reader cannot reconstruct for themselves.
  const clearedText = clearedSentence(verdict.clearedCount);
  const clearedHeight = clearedText ? 60 : 0;
  const caveatHeight = caveatSection(verdict, M, 0, width).height;
  const FOOTER = 190;

  const flags = flagSection(verdict.flags, M, y, width, H - FOOTER - caveatHeight - clearedHeight);
  svg += flags.svg;
  y += flags.height;

  if (clearedText) {
    svg += dot(M + 9, y + 14, 9, INK.ok);
    svg += text(M + 34, y + 24, clearedText, { size: 29, fill: INK.muted });
    y += clearedHeight;
  }

  svg += caveatSection(verdict, M, y, width).svg;

  // Pinned to the bottom rather than flowed, so it is on every screen at the
  // same place whatever the label had on it.
  const footnote = block(M, H - 150, SCORE_FOOTNOTE, width, {
    size: 24,
    fill: INK.muted,
    lineHeight: 33,
  });
  svg += footnote.svg;
  svg += text(M, H - 62, `${verdict.provenance.engineVersion} · ${verdict.provenance.knowledgeVersion}`, {
    size: 20,
    fill: "#4A4C55",
  });

  return document(W, H, svg);
}

/**
 * 1080×1350 — the 4:5 share card. §6: "one tap renders the verdict as a branded
 * share card. Using the app produces content."
 *
 * Tighter than the screen and deliberately so: it has to survive being seen at
 * thumbnail size in somebody else's feed, which means the score, the profile
 * and the top flags, and nothing that turns to grey mush when it is 200px wide.
 * What it must not lose, at any size, is the incomplete banner and the allergen
 * block — those are the parts that stop it from being a confident lie.
 */
export function shareCard(verdict: Verdict): string {
  const W = 1080;
  const H = 1350;
  const M = 72;
  const width = W - M * 2;
  let y = 84;
  let svg = wordmark(M, y);
  y += 40;

  const banner = bannerSection(verdict, M, y, width);
  svg += banner.svg;
  y += banner.height;

  const score = scoreSection(verdict, M, y, width);
  svg += score.svg;
  y += score.height;

  if (verdict.productName) {
    const name = block(M, y, verdict.productName, width, {
      size: 30,
      fill: INK.muted,
      weight: 600,
      lineHeight: 40,
      maxLines: 1,
    });
    svg += name.svg;
    y += name.height + 12;
  }

  const allergens = allergenSection(verdict, M, y, width);
  svg += allergens.svg;
  y += allergens.height;

  svg += flagSection(verdict.flags, M, y, width, H - 130).svg;

  svg += text(M, H - 68, SCORE_FOOTNOTE, { size: 22, fill: INK.muted });

  return document(W, H, svg);
}
