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
await writeFile(`${out}/popuup.svg`, `${wordmark()}\n`);
console.log("public/brand/popuup.svg");
