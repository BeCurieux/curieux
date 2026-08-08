import type { Config } from "tailwindcss";

/**
 * Design language (brief §36): premium, warm, editorial, calm.
 * Outdoorsy without being a hiking app; active without being a gym.
 *
 * The palette is a Saturday morning rather than a product: warm off-white
 * paper, charcoal type, a deep natural green that does the work of a brand
 * colour without shouting, clay for warmth and a washed blue for water —
 * which, for most of our users, is where the good weekends happen.
 *
 * Colour is deliberately restrained. A plan card must look expensive with
 * nothing but type, rule lines and one accent (§54: no photo dependency).
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#FBF8F3", // warm off-white ground
        card: "#FFFFFF",
        ink: "#22201D", // charcoal, for type
        graphite: "#4A4742", // secondary type
        mist: "#8A857D", // tertiary type / captions
        rule: "#E6E0D6", // hairlines
        forest: "#22503F", // deep natural green — primary brand
        sage: "#EAF0EA", // forest at 8%, for fills
        clay: "#B4622F", // muted clay — accents, energy
        clayWash: "#F6E9E0",
        washed: "#4E7C93", // washed blue — water, weather
        washedWash: "#E7EFF3",
      },
      fontFamily: {
        // Fraunces is the editorial display face (§36); the stack degrades to
        // system serifs so the product never depends on a font request.
        display: ["Fraunces", "Iowan Old Style", "Palatino", "Georgia", "serif"],
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
      borderRadius: {
        card: "18px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(34,32,29,0.04), 0 8px 24px -12px rgba(34,32,29,0.12)",
        lift: "0 2px 4px rgba(34,32,29,0.05), 0 18px 40px -18px rgba(34,32,29,0.22)",
      },
      maxWidth: {
        prose: "34rem",
      },
    },
  },
  plugins: [],
};

export default config;
