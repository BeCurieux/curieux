// The site palette.
//
// tailwind.config.ts used to carry a comment saying every pair had been
// measured with contrastRatio() rather than chosen by eye. It was true when
// somebody wrote it and nothing kept it true — which is the exact shape of
// the other claims this project has had to go back and enforce.

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

  it("keeps clay off the paper as type", () => {
    // Terracotta is the brand's one accent and it is legible as a *field*
    // with white on it, not as type on cream. The deeper ochre exists for
    // that, and the difference is invisible to anyone choosing by eye.
    expect(contrastRatio(PALETTE.clay, PALETTE.paper)).toBeLessThan(4.5);
    expect(contrastRatio(PALETTE.ochre, PALETTE.paper)).toBeGreaterThanOrEqual(4.5);
  });

  it("is a ground and an accent, not a colour chart", () => {
    // The books carry the colour — nineteen fixed annual tones. A website
    // with its own competing palette makes them look like decoration.
    expect(Object.keys(PALETTE)).toHaveLength(9);
  });
});
