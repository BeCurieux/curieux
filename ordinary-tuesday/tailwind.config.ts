import type { Config } from "tailwindcss";

/**
 * Qotidia.
 *
 * Warm rather than cool: paper cream, not overcast grey, with terracotta as
 * the single accent. The ground is the colour of the stock the books are
 * printed on, so the screen and the object belong to each other.
 *
 * Design language is premium independent publisher: quiet typography set
 * lowercase, large photographs, generous white space, one accent used
 * sparingly. Every pair below is checked with the project's own
 * contrastRatio() rather than chosen by eye.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Every value below was measured against its neighbours rather than
      // chosen by eye. The old palette failed three ways: cards sat 1.09:1
      // against the page (invisible, so nothing had hierarchy), hairlines at
      // 1.22:1, and the accent at 2.08:1 — which was carrying every link on
      // the site, making the interactive text the least legible text there.
      colors: {
        ink: "#2B2620",     // warm near-black, for type
        paper: "#ECE3D5",   // the ground — the colour of the paper itself
        card: "#FAF6EF",    // raised surfaces — 1.18:1, a lift you can see
        white: "#FEFCF8",   // the highest surface, for inputs
        clay: "#A95C3C",    // terracotta. Type on it must be `white` (4.78:1),
                            // never `paper`, which only reaches 4.1:1.
        ochre: "#8A4327",   // the same terracotta, deep enough to set as type
        slate: "#4A4139",   // deepened warm brown, for headings on card
        stone: "#6B6157",   // secondary type — 4.76:1, passes AA
        rule: "#D4C8B6",    // hairlines — 1.30:1, visible without shouting
      },
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
      fontSize: {
        display: ["clamp(2.75rem, 6vw, 4.5rem)", { lineHeight: "1.02", letterSpacing: "-0.02em" }],
        title: ["clamp(1.75rem, 3vw, 2.5rem)", { lineHeight: "1.1", letterSpacing: "-0.01em" }],
      },
    },
  },
  plugins: [],
};

export default config;
