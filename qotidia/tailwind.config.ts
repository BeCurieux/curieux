import type { Config } from "tailwindcss";
import { PALETTE } from "./src/lib/palette";

/**
 * Qotidia.
 *
 * Warm rather than cool: paper cream, not overcast grey, with terracotta as
 * the single accent. The ground is the colour of the stock the books are
 * printed on, so the screen and the object belong to each other.
 *
 * Design language is an independent publishing house that happens to use
 * technology: quiet typography set lowercase, large photographs, generous
 * white space, one accent used sparingly.
 *
 * The colours moved to src/lib/palette.ts, where a test holds every pair to
 * a measured minimum. This file used to claim they had been checked, and
 * nothing checked them.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      maxWidth: {
        // The brief's 1440. max-w-6xl (1152) is a SaaS container and it made
        // every section the same width, which is the opposite of an
        // editorial grid.
        page: "90rem",
        column: "68ch",
      },
      // Every value below was measured against its neighbours rather than
      // chosen by eye. The old palette failed three ways: cards sat 1.09:1
      // against the page (invisible, so nothing had hierarchy), hairlines at
      // 1.22:1, and the accent at 2.08:1 — which was carrying every link on
      // the site, making the interactive text the least legible text there.
      // One source, and tests/palette.test.ts holds every pair to a
      // measured minimum. See src/lib/palette.ts.
      colors: PALETTE,
      fontFamily: {
        // Charter for everything anyone reads; the sans is for micro-labels
        // and form furniture only, exactly as the printed page divides them.
        display: ["var(--font-charter)", "Georgia", "serif"],
        body: ["var(--font-charter)", "Georgia", "serif"],
        ui: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
      },
      // The old scale ran 36→12px in six near-equal steps, all at one weight:
      // nothing was big and nothing was small. The book runs 82pt against
      // 7pt. This opens the top end so a page can have a voice.
      // An editorial scale, not a UI one. The old top end was 72px and
      // every big heading on the site was reaching past it with an inline
      // clamp, which is the sign of a scale that does not fit the work.
      // Naming them means a section heading is one class and always the
      // same size as every other section heading.
      fontSize: {
        hero:    ["clamp(3.25rem, 7.5vw, 6.5rem)",  { lineHeight: "0.94", letterSpacing: "-0.025em" }],
        display: ["clamp(2.5rem, 5.5vw, 5.125rem)", { lineHeight: "0.98", letterSpacing: "-0.02em" }],
        title:   ["clamp(1.875rem, 3.2vw, 3rem)",   { lineHeight: "1.08", letterSpacing: "-0.015em" }],
        subhead: ["clamp(1.25rem, 1.6vw, 1.5rem)",  { lineHeight: "1.3" }],
        lede:    ["clamp(1.0625rem, 1.2vw, 1.1875rem)", { lineHeight: "1.65" }],
      },
    },
  },
  plugins: [],
};

export default config;
