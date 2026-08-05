import type { Config } from "tailwindcss";

/**
 * Ordinary Tuesday.
 *
 * The palette is the name: an overcast weekday, and one yellow thing in it.
 * Ground is a cool, faintly green grey — kitchen light at four o'clock,
 * not the warm cream every family-memory brand reaches for. The accent is
 * the yellow of rain boots worn on a day with no rain, which is the emblem
 * of the whole product: an ordinary object made significant by someone
 * insisting on it.
 *
 * Design language stays premium independent publisher: strong typography,
 * large photographs, generous white space, restrained colour.
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
        ink: "#191A17",     // warm near-black, for type — 14.9:1 on paper
        paper: "#E4E4DC",   // overcast; darkened so surfaces can sit on it
        card: "#F7F7F2",    // raised surfaces — 1.19:1, a lift you can see
        white: "#FDFDFB",   // the highest surface, for inputs
        boot: "#D99A16",    // the yellow boots — large blocks only, never type
        ochre: "#8A5B0B",   // the same yellow, taken to where it can be read
        slate: "#3E4548",   // wet footpath — deepened for headings on card
        stone: "#5F635E",   // secondary type — 4.8:1, passes AA
        rule: "#BEBEB3",    // hairlines — 1.47:1, visible without shouting
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
