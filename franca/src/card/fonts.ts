/**
 * The two faces, read off disk and inlined as data URIs.
 *
 * A card is a file somebody sends to somebody else, so a card that only looks
 * right on a machine with the fonts installed is not a card. The renderers
 * stay pure and take the result of this as an argument; the reading of files
 * happens here and nowhere inside them.
 *
 * Newsreader ships a weight-axis-only variable file alongside the full one,
 * and that is the one to take: a third of the size, and the optical-size axis
 * is not used at these sizes.
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import type { EmbeddedFonts } from "./tokens.js";

/**
 * Resolved through `require.resolve` rather than joined onto "node_modules",
 * so this works from any working directory and under pnpm's symlinked store,
 * where the real file is nowhere near the directory the path suggests.
 */
export const FONT_FILES = {
  display: "@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2",
  text: "@fontsource-variable/newsreader/files/newsreader-latin-wght-normal.woff2",
} as const satisfies Record<keyof EmbeddedFonts, string>;

const require = createRequire(import.meta.url);

/** Absolute path of one packaged face, or undefined if the package moved it. */
export function resolveFont(slot: keyof typeof FONT_FILES): string | undefined {
  try {
    return require.resolve(FONT_FILES[slot]);
  } catch {
    return undefined;
  }
}

/**
 * Whatever could be loaded. A missing face is a worse-looking card, never a
 * failed run — the fallback stack in `FONTS` is a real serif everywhere. The
 * warning goes to stderr so a founder notices before sending thirty of them.
 */
export function loadEmbeddedFonts(warn: (message: string) => void = console.warn): EmbeddedFonts | undefined {
  const fonts: EmbeddedFonts = {};
  for (const slot of Object.keys(FONT_FILES) as (keyof typeof FONT_FILES)[]) {
    const path = resolveFont(slot);
    if (!path) {
      warn(`(typeface not found, falling back: ${FONT_FILES[slot]})`);
      continue;
    }
    fonts[slot] = `data:font/woff2;base64,${readFileSync(path).toString("base64")}`;
  }
  return Object.keys(fonts).length > 0 ? fonts : undefined;
}
