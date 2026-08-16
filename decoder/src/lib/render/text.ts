/**
 * Enough text metrics to lay out an SVG without a browser.
 *
 * The renderer produces SVG that a browser later rasterises, but the wrapping
 * has to happen here — SVG has no flow layout, so every line break is a
 * decision this file makes. The widths are an approximation of a humanist sans
 * at the sizes the cards actually use, calibrated to over-estimate slightly:
 * a line that wraps one word early looks considered, and a line that overflows
 * the card looks broken.
 */

/** Relative advance widths, as a fraction of font size. */
const NARROW = new Set([..."iljtfIr.,:;'!|()[]{}·-"]);
const WIDE = new Set([..."mwMW@%"]);
const CAPS = new Set([..."ABCDEFGHJKLNOPQRSTUVXYZ0123456789"]);

export function measure(text: string, fontSize: number): number {
  let units = 0;
  for (const char of text) {
    if (NARROW.has(char)) units += 0.31;
    else if (WIDE.has(char)) units += 0.88;
    else if (char === " ") units += 0.28;
    else if (CAPS.has(char)) units += 0.63;
    else units += 0.53;
  }
  return units * fontSize;
}

/**
 * Break `text` into lines that fit `maxWidth`.
 *
 * A word longer than the line is left to overflow rather than hyphenated:
 * ingredient names are the long words here, and a broken one is harder to read
 * than a wide one — "poly-" on one line and "sorbate 80" on the next is a
 * different-looking ingredient.
 */
export function wrap(text: string, maxWidth: number, fontSize: number, maxLines = Infinity): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (measure(candidate, fontSize) <= maxWidth || line === "") {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);

  if (lines.length === maxLines && words.length > 0) {
    const last = lines[maxLines - 1] as string;
    const rest = text.slice(lines.join(" ").length).trim();
    if (rest) lines[maxLines - 1] = truncate(last, maxWidth, fontSize);
  }
  return lines;
}

function truncate(line: string, maxWidth: number, fontSize: number): string {
  let out = line;
  while (out.length > 1 && measure(`${out}…`, fontSize) > maxWidth) out = out.slice(0, -1);
  return `${out.trimEnd()}…`;
}

/** SVG is XML. Ingredient text comes from a photograph of somebody's packaging. */
export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
