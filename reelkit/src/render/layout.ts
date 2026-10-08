/**
 * Fitting words in a box. Pure: the measuring function is passed in, so the
 * same code runs against a canvas in the browser and a stub in tests.
 */

export type Measure = (text: string, size: number) => number;

export function wrap(text: string, maxWidth: number, size: number, measure: Measure): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (!line || measure(next, size) <= maxWidth) {
      line = next;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** The largest size, from `max` down to `min`, at which the text fits in
 *  `maxLines` lines with no line wider than the box. */
export function fit(
  text: string,
  box: { width: number; maxLines: number; max: number; min: number },
  measure: Measure,
): { size: number; lines: string[] } {
  for (let size = box.max; size >= box.min; size -= 2) {
    const lines = wrap(text, box.width, size, measure);
    if (lines.length <= box.maxLines && lines.every((l) => measure(l, size) <= box.width)) {
      return { size, lines };
    }
  }
  return { size: box.min, lines: wrap(text, box.width, box.min, measure) };
}

/** Cover-fit an image into a frame, then apply a zoom and a pan expressed as
 *  a fraction (-1…1) of the overflow, so the frame is always filled. */
export function cover(
  img: { w: number; h: number },
  frame: { w: number; h: number },
  scale: number,
  panX: number,
  panY: number,
): { x: number; y: number; w: number; h: number } {
  const base = Math.max(frame.w / img.w, frame.h / img.h) * Math.max(1, scale);
  const w = img.w * base;
  const h = img.h * base;
  const overX = (w - frame.w) / 2;
  const overY = (h - frame.h) / 2;
  const clamp = (v: number) => Math.max(-1, Math.min(1, v));
  return { x: -overX + clamp(panX) * overX, y: -overY + clamp(panY) * overY, w, h };
}
