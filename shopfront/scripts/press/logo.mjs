/**
 * Writes the brand-colour wordmark to public/brand/popuup.svg.
 *
 * The asset is committed, because a logo that only exists when a script runs
 * is a logo somebody will end up re-tracing. It is generated rather than
 * hand-kept so that it and the posters cannot drift: `wordmark.mjs` is the
 * geometry, this is the brand-colour rendering of it, and compose.mjs asks the
 * same module for the light-ground version.
 */

import { writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { wordmark } from "./wordmark.mjs";

const out = resolve(import.meta.dirname, "../../public/brand");
await mkdir(out, { recursive: true });

// Two files, one geometry. The brand-colour navy is invisible on a violet
// ground, and a landing page that needs the mark in white should not be
// re-drawing it — that is exactly how a logo ends up with two versions that
// disagree about letterspacing.
await writeFile(`${out}/popuup.svg`, `${wordmark()}\n`);
await writeFile(`${out}/popuup-light.svg`, `${wordmark({ ink: "#FFFFFF", accent: "#B9A3FF", id: "uu-light" })}\n`);
console.log("public/brand/popuup.svg + popuup-light.svg");
