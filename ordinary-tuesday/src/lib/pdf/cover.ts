// Cover rendering for a case-bound (hardcover) book.
//
// A hardcover cover is printed flat as one sheet — back cover, spine, front
// cover — then wrapped around three boards and glued, with the edges folded
// in. So the printed sheet is larger than the finished book in every
// direction, and the spine width depends on how thick the paper actually is.
//
// THE ONE UNKNOWN: paper caliper. Two stocks are candidates (brief §17) and
// their calipers are PROVISIONAL until physical samples are measured with a
// micrometer. Everything else here is arithmetic. Get the caliper wrong and
// the spine text sits off-centre on every copy — so `measured: false` is
// treated as a preflight warning, and the book spec refuses to guess.

import { BOOK_SPEC } from "@/lib/book/structure";

export interface PaperStock {
  id: string;
  name: string;
  /** Thickness of ONE sheet (two printed pages), in inches. */
  caliperInches: number;
  /** False until someone has measured a physical sample. */
  measured: boolean;
}

export const PAPER_STOCKS: Record<string, PaperStock> = {
  // Uncoated, warm, matte — the editorial choice.
  mohawk_superfine_eggshell: {
    id: "mohawk_superfine_eggshell",
    name: "Mohawk Superfine Eggshell 118gsm",
    caliperInches: 0.0063, // PROVISIONAL — from published bulk, not measured
    measured: false,
  },
  // Coated photo stock — the conventional photobook choice.
  gloss_photo_200: {
    id: "gloss_photo_200",
    name: "Gloss photo 200gsm",
    caliperInches: 0.0079, // PROVISIONAL
    measured: false,
  },
};

/** Case-binding allowances. Provider-specific; these match Prodigi hardcover. */
export const CASE_BINDING = {
  /** Board thickness, each of the three boards. */
  boardThicknessInches: 0.098, // 2.5mm greyboard
  /** How far the board overhangs the text block on three sides. */
  boardOverhangInches: 0.118, // 3mm
  /** Gap between spine board and cover boards, so the hinge can flex. */
  hingeGapInches: 0.276, // 7mm each side
  /** Printed material folded over the board edge and glued inside. */
  turnInInches: 0.591, // 15mm all round
} as const;

export interface CoverGeometry {
  /** Total printed sheet, including turn-in on every edge. */
  sheetWidthInches: number;
  sheetHeightInches: number;
  spineWidthInches: number;
  /** Finished board dimensions, for placing artwork. */
  boardWidthInches: number;
  boardHeightInches: number;
  turnInInches: number;
  hingeGapInches: number;
  /** Distance from the sheet's left edge to the start of the spine. */
  spineLeftInches: number;
}

/**
 * Spine width for a case-bound book.
 * Pages are printed two to a sheet, so a 64-page book is 32 sheets of paper,
 * plus the two cover boards it has to bridge.
 */
export function spineWidth(pageCount: number, stock: PaperStock): number {
  const sheets = Math.ceil(pageCount / 2);
  const textBlock = sheets * stock.caliperInches;
  return textBlock + 2 * CASE_BINDING.boardThicknessInches;
}

export function coverGeometry(pageCount: number, stock: PaperStock): CoverGeometry {
  const spine = spineWidth(pageCount, stock);
  const boardWidth = BOOK_SPEC.trimWidthInches + CASE_BINDING.boardOverhangInches;
  const boardHeight = BOOK_SPEC.trimHeightInches + 2 * CASE_BINDING.boardOverhangInches;

  // back board + hinge + spine + hinge + front board, plus turn-in each side.
  const sheetWidth =
    2 * boardWidth + spine + 2 * CASE_BINDING.hingeGapInches + 2 * CASE_BINDING.turnInInches;
  const sheetHeight = boardHeight + 2 * CASE_BINDING.turnInInches;

  return {
    sheetWidthInches: round(sheetWidth),
    sheetHeightInches: round(sheetHeight),
    spineWidthInches: round(spine),
    boardWidthInches: round(boardWidth),
    boardHeightInches: round(boardHeight),
    turnInInches: CASE_BINDING.turnInInches,
    hingeGapInches: CASE_BINDING.hingeGapInches,
    spineLeftInches: round(
      CASE_BINDING.turnInInches + boardWidth + CASE_BINDING.hingeGapInches
    ),
  };
}

/**
 * A spine only carries type if it is wide enough to set it legibly.
 * Below this, the spine is printed blank rather than with unreadable text.
 */
export const MIN_SPINE_TEXT_INCHES = 0.25;

export function spineTakesText(spineWidthInches: number): boolean {
  return spineWidthInches >= MIN_SPINE_TEXT_INCHES;
}

export interface CoverContent {
  title: string;
  subtitle?: string;
  /** Imprint shown on the spine and back cover. */
  imprint?: string;
  /** Signed URL for the front-cover photograph, if any. */
  frontImageUrl?: string;
}

export function renderCoverHtml(
  content: CoverContent,
  geo: CoverGeometry
): string {
  const showSpineText = spineTakesText(geo.spineWidthInches);
  const imprint = content.imprint ?? "";

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { size: ${geo.sheetWidthInches}in ${geo.sheetHeightInches}in; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Georgia, "Times New Roman", serif; color: #f5f2ea; }
  .sheet {
    width: ${geo.sheetWidthInches}in; height: ${geo.sheetHeightInches}in;
    background: #1d2334; position: relative; overflow: hidden;
    display: flex; align-items: stretch;
  }
  /* Turn-in is folded inside and never seen — artwork must not rely on it,
     but the background must cover it or a white edge shows on the fold. */
  .turn-in { width: ${geo.turnInInches}in; flex: none; }
  .board {
    width: ${geo.boardWidthInches}in; flex: none;
    padding: ${geo.turnInInches}in ${geo.turnInInches}in;
    display: flex; flex-direction: column;
  }
  .hinge { width: ${geo.hingeGapInches}in; flex: none; }
  .spine {
    width: ${geo.spineWidthInches}in; flex: none;
    display: flex; align-items: center; justify-content: center;
    padding: ${geo.turnInInches}in 0;
  }
  .spine-text {
    writing-mode: vertical-rl; text-orientation: mixed;
    white-space: nowrap; font-size: 11pt; letter-spacing: 0.04em;
    color: rgba(245, 242, 234, 0.92);
  }
  .front { justify-content: flex-end; }
  .front h1 { font-size: 30pt; font-weight: normal; line-height: 1.05; letter-spacing: -0.02em; }
  .front .sub { font-size: 14pt; color: rgba(245, 242, 234, 0.6); margin-top: 0.12in; }
  .front .cover-photo {
    flex: 1; margin-bottom: 0.35in; border-radius: 1px;
    background-size: cover; background-position: center;
  }
  .back { justify-content: flex-end; }
  .back .imprint {
    font-family: Helvetica, Arial, sans-serif; font-size: 7.5pt;
    letter-spacing: 0.22em; text-transform: uppercase;
    color: rgba(245, 242, 234, 0.45);
  }
</style>
</head>
<body>
<div class="sheet">
  <span class="turn-in"></span>

  <div class="board back">
    <div class="imprint">${esc(imprint)}</div>
  </div>

  <span class="hinge"></span>
  <div class="spine">
    ${showSpineText
      ? `<span class="spine-text">${esc(content.title)}${content.subtitle ? ` &middot; ${esc(content.subtitle)}` : ""}</span>`
      : ""}
  </div>
  <span class="hinge"></span>

  <div class="board front">
    ${content.frontImageUrl
      ? `<div class="cover-photo" style="background-image:url('${esc(content.frontImageUrl)}')"></div>`
      : `<div class="cover-photo"></div>`}
    <h1>${esc(content.title)}</h1>
    ${content.subtitle ? `<div class="sub">${esc(content.subtitle)}</div>` : ""}
  </div>

  <span class="turn-in"></span>
</div>
</body>
</html>`;
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
