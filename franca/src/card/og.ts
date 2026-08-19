/**
 * The share card: 1200 × 630, the object that travels.
 *
 * BRIEF.md §4 says the OG image is the score card, and §8 makes the shareable
 * result the first growth channel. So this is not a thumbnail of the page —
 * it is the page reduced to the three things that survive being seen at the
 * size of a phone in somebody's hand: the number, the market it came from, and
 * one phrase in the brand's own words with a line under it.
 *
 * Pure SVG and no foreignObject. Rasterisers disagree about foreignObject and
 * several silently drop it, and this file has to survive whatever renders it.
 * The cost is that text has to be wrapped here rather than by a layout engine,
 * which is what `wrapText` is for. Faces can be inlined as `<style>` — see
 * `fonts` below — but the layout never assumes they arrived.
 */

import type { ScanResult } from "../engine/types.js";
import { weakestOf } from "../engine/evaluate.js";
import { annotate, headlineMark } from "./annotate.js";
import { escXml } from "./escape.js";
import {
  BAND_LABEL,
  FONTS,
  MARKET_LABEL,
  marketAccent,
  PALETTE,
  WORDMARK,
  fontFaces,
  longDate,
  type EmbeddedFonts,
} from "./tokens.js";

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

export type ShareCardOptions = {
  text: string;
  result: ScanResult;
  reviewedOn: Date;
  /** Masthead. Defaults to `WORDMARK`. */
  wordmark?: string;
  /**
   * Faces inlined into the SVG itself, for the renderer that honours them.
   *
   * Most rasterisers do, browsers do, and social-media crawlers show the PNG
   * rather than this file. Where a renderer ignores it the stack falls back to
   * something serif and the card is merely less itself, which is the right
   * failure: a share card that refuses to draw is worse than one set in
   * Georgia.
   */
  fonts?: EmbeddedFonts;
};

/**
 * Greedy wrap against an estimated advance width.
 *
 * A real measurement needs a text engine, so this approximates. Instrument
 * Serif measures about 0.34em per character in mixed-case display text; 0.40
 * is used here so the estimate errs narrow, which fails in the safe direction —
 * a line that breaks one word early looks considered, and a line that overruns
 * the frame looks broken.
 */
export function wrapText(text: string, maxWidth: number, fontSize: number, maxLines = 2): string[] {
  const perChar = fontSize * 0.4;
  const budget = Math.max(1, Math.floor(maxWidth / perChar));
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= budget) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = word;
    if (lines.length === maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);

  if (lines.length === maxLines) {
    const consumed = lines.join(" ").split(/\s+/).length;
    if (consumed < words.length) {
      const last = lines[maxLines - 1] ?? "";
      lines[maxLines - 1] = `${last.slice(0, Math.max(0, budget - 1)).trimEnd()}…`;
    }
  }
  return lines;
}

function text(
  content: string,
  x: number,
  y: number,
  opts: {
    size: number;
    family: string;
    fill: string;
    spacing?: number;
    anchor?: string;
    className?: string;
  },
): string {
  return (
    `<text x="${x}" y="${y}" font-family='${escXml(opts.family)}' font-size="${opts.size}" ` +
    `fill="${opts.fill}"` +
    (opts.spacing ? ` letter-spacing="${opts.spacing}"` : "") +
    (opts.anchor ? ` text-anchor="${opts.anchor}"` : "") +
    (opts.className ? ` class="${opts.className}"` : "") +
    `>${escXml(content)}</text>`
  );
}

/** Advance width of one lining figure at a given display size. */
const digitAdvance = (size: number) => size * 0.41;

const MONO = (size: number, fill: string, spacing = 2.2) => ({
  size,
  family: FONTS.mono,
  fill,
  spacing,
});
const DISPLAY = (size: number, fill: string) => ({ size, family: FONTS.display, fill });
const BODY = (size: number, fill: string) => ({ size, family: FONTS.text, fill });

export function shareCard(options: ShareCardOptions): string {
  const { result, reviewedOn, wordmark, fonts } = options;
  const weakest = weakestOf(result.jurisdictions, result.byJurisdiction);
  const { marks } = annotate(options.text, result.findings);
  const lead = headlineMark(marks);

  const M = 64; // frame margin
  const parts: string[] = [];

  const faces = fontFaces(fonts);
  // The rule under the quoted phrase is a text decoration rather than a drawn
  // line, because a drawn line needs the text's width and nothing here can
  // measure it — the earlier guess overran the phrase by a third of its length.
  //
  // Chromium ignores `text-decoration-color` on SVG text and paints the
  // underline in the text's own fill, so the phrase is set in the accent
  // rather than fighting it. That lands where the palette says it should
  // anyway: the accent belongs to the words the scan is talking about, and the
  // band label above it is ink.
  parts.push(
    `<style>${faces}.q{text-decoration:underline;text-decoration-thickness:1.5px;` +
      `text-underline-offset:0.16em}</style>`,
  );
  parts.push(`<rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="${PALETTE.paper}"/>`);
  parts.push(
    `<rect x="${M / 2}" y="${M / 2}" width="${OG_WIDTH - M}" height="${OG_HEIGHT - M}" ` +
      `fill="none" stroke="${PALETTE.rule}"/>`,
  );

  // ------------------------------------------------------------- masthead
  parts.push(text((wordmark ?? WORDMARK).toUpperCase(), M, M + 22, MONO(13, PALETTE.ink, 4.4)));
  parts.push(
    text(longDate(reviewedOn).toUpperCase(), OG_WIDTH - M, M + 22, {
      ...MONO(12, PALETTE.inkFaint),
      anchor: "end",
    }),
  );
  parts.push(
    `<line x1="${M}" y1="${M + 44}" x2="${OG_WIDTH - M}" y2="${M + 44}" stroke="${PALETTE.rule}"/>`,
  );

  // ---------------------------------------------------------------- score
  const baseline = 330;
  const value = String(result.score.value);
  parts.push(text(value, M - 8, baseline, DISPLAY(232, PALETTE.ink)));
  // Measured, not guessed: Instrument Serif digits run about 0.41em, so a
  // two-digit score is ~190 units at this size. The old estimate left "/100"
  // floating half a centimetre off the numeral it belongs to.
  const numeralWidth = value.length * digitAdvance(232) + 16;
  parts.push(text("/100", M - 8 + numeralWidth, baseline, DISPLAY(38, PALETTE.inkFaint)));
  parts.push(text(BAND_LABEL[result.score.band], M, baseline + 78, DISPLAY(56, PALETTE.ink)));

  // --------------------------------------------------------------- ledger
  const ledgerX = 830;
  parts.push(text("BY MARKET", ledgerX, 168, MONO(11, PALETTE.inkFaint)));
  let row = 196;
  for (const jurisdiction of result.jurisdictions) {
    const score = result.byJurisdiction[jurisdiction];
    const isWeakest = jurisdiction === weakest && result.jurisdictions.length > 1;
    parts.push(
      `<line x1="${ledgerX}" y1="${row}" x2="${OG_WIDTH - M}" y2="${row}" stroke="${PALETTE.ruleFaint}"/>`,
    );
    // A short tick in the market's own hue, then the name in it. Identity,
    // not severity: the same colour whatever the number to its right says.
    parts.push(
      `<line x1="${ledgerX}" y1="${row}" x2="${ledgerX + 26}" y2="${row}" ` +
        `stroke="${marketAccent(jurisdiction)}" stroke-width="2"/>`,
    );
    parts.push(
      text(MARKET_LABEL[jurisdiction] ?? jurisdiction, ledgerX, row + 34, BODY(22, marketAccent(jurisdiction))),
    );
    parts.push(
      text(String(score?.value ?? "—"), OG_WIDTH - M, row + 36, {
        ...DISPLAY(40, isWeakest ? PALETTE.accent : PALETTE.ink),
        anchor: "end",
      }),
    );
    row += 54;
  }

  // ------------------------------------------------------ the lead phrase
  const quoteY = 470;
  parts.push(`<line x1="${M}" y1="${quoteY - 44}" x2="${OG_WIDTH - M}" y2="${quoteY - 44}" stroke="${PALETTE.rule}"/>`);

  if (lead) {
    const size = 44;
    const lines = wrapText(`“${lead.text.trim()}”`, OG_WIDTH - M * 2 - 220, size, 2);
    lines.forEach((line, i) => {
      parts.push(
        text(line, M, quoteY + i * (size + 10), { ...DISPLAY(size, PALETTE.accent), className: "q" }),
      );
    });
    const others = marks.length - 1;
    parts.push(
      text(
        others > 0 ? `AND ${others} MORE ${others === 1 ? "PHRASE" : "PHRASES"}` : "ONE PHRASE",
        OG_WIDTH - M,
        quoteY,
        { ...MONO(12, PALETTE.inkFaint), anchor: "end" },
      ),
    );
  } else {
    parts.push(
      text("Nothing here trips a rule in the markets checked.", M, quoteY, DISPLAY(44, PALETTE.ink)),
    );
  }

  // --------------------------------------------------------------- footer
  const footY = OG_HEIGHT - M - 12;
  parts.push(`<line x1="${M}" y1="${footY - 30}" x2="${OG_WIDTH - M}" y2="${footY - 30}" stroke="${PALETTE.rule}"/>`);
  parts.push(
    text(
      `REVIEWED AGAINST ${result.jurisdictions.join(" · ")}`,
      M,
      footY,
      MONO(12, PALETTE.inkSoft),
    ),
  );
  parts.push(
    text("AN OPINION ABOUT LANGUAGE — NOT LEGAL ADVICE", OG_WIDTH - M, footY, {
      ...MONO(12, PALETTE.inkFaint),
      anchor: "end",
    }),
  );

  const label = `Claim confidence ${result.score.value} out of 100, ${BAND_LABEL[result.score.band]}, reviewed against ${result.jurisdictions.join(", ")}.`;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" ` +
    `viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}" role="img" aria-label="${escXml(label)}">` +
    `<title>${escXml(label)}</title>${parts.join("")}</svg>`
  );
}
