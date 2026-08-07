// Are the typefaces on this machine the typefaces we shipped?
//
// The site is set in Charter, self-hosted, and a font file is the one asset
// in the repository where damage is both easy and invisible. Git for Windows
// rewrites line endings on checkout and decides what is text by sniffing for
// NUL bytes; when that guess goes wrong, every `\n` inside the compressed
// stream becomes `\r\n`, the file is a few bytes longer than it should be,
// and nothing anywhere says so. The page just renders wrong.
//
// This does not need a list of known-good checksums, which would go stale
// the day anybody legitimately changes a font. A woff2 file carries its own
// total length in its header, at bytes 8–11. If a single byte has been
// inserted or removed anywhere in the file, that number no longer matches
// what is on disk. The file validates itself.
//
//     npm run check:fonts

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const dir = fileURLToPath(new URL("../src/fonts", import.meta.url));

/** What a woff2 header says about itself. */
function header(bytes) {
  if (bytes.length < 48) return { signature: "(too short to be a font)", declared: null };
  return {
    signature: bytes.subarray(0, 4).toString("latin1"),
    flavour: bytes.subarray(4, 8).toString("latin1"),
    declared: bytes.readUInt32BE(8),
    tables: bytes.readUInt16BE(12),
  };
}

const files = readdirSync(dir).filter((f) => f.endsWith(".woff2")).sort();
if (files.length === 0) {
  console.error(`No .woff2 files in ${dir} — the site has no typeface.`);
  process.exit(1);
}

let broken = 0;

for (const name of files) {
  const bytes = readFileSync(join(dir, name));
  const h = header(bytes);

  if (h.signature !== "wOF2") {
    console.log(`✗ ${name} — not a woff2 file. It starts with ${JSON.stringify(h.signature)}.`);
    broken++;
    continue;
  }

  if (h.declared !== bytes.length) {
    const drift = bytes.length - h.declared;
    console.log(
      `✗ ${name} — the file says it is ${h.declared} bytes and it is ${bytes.length}` +
        ` (${drift > 0 ? "+" : ""}${drift}).`
    );
    // A checkout that converted line endings only ever adds bytes, one per
    // newline, so a positive drift with a plausible newline count is the
    // signature of exactly that.
    if (drift > 0) {
      console.log(
        `  That is what a line-ending conversion looks like. Fix it with:\n` +
          `    git rm --cached -r . && git reset --hard\n` +
          `  (.gitattributes already declares fonts binary, so the fresh` +
          ` checkout will be correct.)`
      );
    }
    broken++;
    continue;
  }

  console.log(`✓ ${name} — ${bytes.length} bytes, ${h.flavour === "OTTO" ? "CFF" : "glyf"} outlines, ${h.tables} tables.`);
}

if (broken > 0) {
  console.log(`\n${broken} of ${files.length} font files are damaged on this machine.`);
  process.exit(1);
}

console.log(`\nAll ${files.length} font files are intact.`);
