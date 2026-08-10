// The site palette.
//
// tailwind.config.ts used to carry a comment saying every pair had been
// measured with contrastRatio() rather than chosen by eye. It was true when
// somebody wrote it and nothing kept it true — which is the exact shape of
// the other claims this project has had to go back and enforce.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "@/lib/book/colours";
import { CONTRACTS, PALETTE } from "@/lib/palette";

describe("the palette", () => {
  it.each(CONTRACTS)("$what clears $min:1", ({ fg, bg, min, because }) => {
    const ratio = contrastRatio(fg, bg);
    expect(
      ratio,
      `${fg} on ${bg} is ${ratio.toFixed(2)}:1, needs ${min}:1. ${because}`
    ).toBeGreaterThanOrEqual(min);
  });

  it("has an accent legible as type, which the last one was not", () => {
    // This test used to assert the opposite: that clay must be *below* 4.5,
    // because terracotta could not be read as type on cream. The codebase
    // had never honoured it — `text-clay` sets every uppercase label in the
    // product. Oxblood is dark enough that the rule inverts, so both tones
    // are now held to body contrast rather than one being quarantined.
    expect(contrastRatio(PALETTE.clay, PALETTE.paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(PALETTE.ochre, PALETTE.paper)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the two accent tones apart", () => {
    // Labels and links sit next to each other constantly. Same family, and
    // far enough apart to read as a deliberate pair rather than a mistake.
    const apart = contrastRatio(PALETTE.clay, PALETTE.ochre);
    expect(apart).toBeGreaterThan(1.2);
    expect(apart).toBeLessThan(2.5);
  });

  it("is a ground and an accent, not a colour chart", () => {
    // The books carry the colour — nineteen fixed annual tones. A website
    // with its own competing palette makes them look like decoration.
    expect(Object.keys(PALETTE)).toHaveLength(9);
  });
});

describe("nothing sets a site colour by hand", () => {
  // The manifest carried #F2E9DC — a third paper colour, matching neither
  // the palette nor the value before it — and it is what the operating
  // system paints behind the installed app. Drift on the one surface nobody
  // looks at. A palette module is only authoritative if nothing bypasses it.
  const SRC = new URL("../src", import.meta.url).pathname;

  function files(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) files(full, out);
      else if (/\.(tsx?|css)$/.test(entry)) out.push(full);
    }
    return out;
  }

  it("no palette value appears as a literal outside the palette", () => {
    const offenders: string[] = [];
    for (const file of files(SRC)) {
      if (file.endsWith("src/lib/palette.ts")) continue;
      const body = readFileSync(file, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      for (const [name, hex] of Object.entries(PALETTE)) {
        if (body.toUpperCase().includes(hex.toUpperCase())) {
          offenders.push(`${file.slice(file.indexOf("src/"))} hardcodes ${name} (${hex})`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("leaves the books' own colours alone", () => {
    // lib/book/colours.ts holds nineteen fixed annual spine colours. They are
    // a different palette on purpose — the site is the paper the books sit
    // on — and one of them is still called terracotta. That is not drift.
    const books = readFileSync(
      new URL("../src/lib/book/colours.ts", import.meta.url), "utf8");
    expect(books).toContain("terracotta");
  });
});
