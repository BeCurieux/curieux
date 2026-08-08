// The sample spreads on the landing page.
//
// A broken image is the failure mode nothing else here catches. TypeScript
// does not know whether a file exists in public/, the build does not fetch
// it, and the page renders perfectly well with three grey boxes on it. Only
// a person looking at the site would find out, and by then it has been like
// that for a fortnight.

import { existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SPREADS, SPREADS_DISCLOSURE, spreadSrc } from "@/lib/marketing/spreads";
import { SAMPLE_PAGES } from "@/lib/book/sample-volume";

const publicPath = (src: string) =>
  fileURLToPath(new URL(`../public${src}`, import.meta.url));

describe("the spreads the page shows", () => {
  it("has a rendered file for every one of them", () => {
    for (const s of SPREADS) {
      expect(existsSync(publicPath(spreadSrc(s.id))), `${s.id} has not been rendered`).toBe(true);
    }
  });

  it("keeps them light enough to put on a landing page", () => {
    // They are committed to the repository and the image optimiser is off,
    // so what is written here is exactly what every visitor downloads. The
    // first render of these three was 2.5MB of PNG.
    const total = SPREADS.reduce((n, s) => n + statSync(publicPath(spreadSrc(s.id))).size, 0);
    expect(total).toBeLessThan(500_000);
  });

  it("asks for pages the sample volume actually has", () => {
    // The renderer throws on a missing page, but only when someone runs it.
    // This fails the moment the volume is edited.
    const last = SAMPLE_PAGES.length;
    for (const s of SPREADS) {
      expect(s.left).toBeGreaterThanOrEqual(1);
      expect(s.right).toBe(s.left + 1);
      expect(s.right, `spread ${s.id} runs past the end of the book`).toBeLessThanOrEqual(last);
    }
  });

  it("puts the verso on the left, the way a book opens", () => {
    // A spread is an even page facing the odd one after it. Pairing 3 with 4
    // is two pages that never face each other, and would quietly show a
    // relationship the printed book does not have.
    for (const s of SPREADS) expect(s.left % 2).toBe(0);
  });

  it("describes each one for somebody who cannot see it", () => {
    for (const s of SPREADS) {
      expect(s.alt.length).toBeGreaterThan(40);
      expect(s.caption.length).toBeGreaterThan(10);
    }
  });

  it("says the photographs are stand-ins, next to the photographs", () => {
    // Non-negotiable on a page selling a photo book. The layouts are
    // genuine; the pictures are generated, and the page has to say so.
    expect(SPREADS_DISCLOSURE).toMatch(/stand-ins?/i);
    expect(SPREADS_DISCLOSURE).toMatch(/no real child/i);

    const landing = readFileSync(
      new URL("../src/app/page.tsx", import.meta.url),
      "utf8"
    );
    expect(landing).toContain("SPREADS_DISCLOSURE");
  });
});
