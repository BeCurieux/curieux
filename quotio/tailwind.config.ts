import type { Config } from "tailwindcss";

/**
 * MEKMI's design system (brief §5–§7).
 *
 * The look is "playful tech brand + exceptionally polished product UI".
 * Three rules keep it there, and they are encoded in these tokens rather
 * than left to each screen's judgement:
 *
 * 1. The canvas is warm white and the type is deep navy. Purple is the
 *    action colour only — never a page background. Mint, yellow and coral
 *    are accents, illustrations and result states.
 * 2. Everything is generously rounded. There is no 4px radius in this
 *    product; the smallest rounded thing is a 10px tag.
 * 3. Elevation comes from a 1px lavender border plus a barely-there
 *    shadow tinted navy — never black, never glassmorphism.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Electric violet. Kept under the `purple` token name because it is
        // one, and renaming it would touch a few hundred class names for no
        // gain — the value is what the brand specifies.
        purple: {
          DEFAULT: "#7657F6",
          soft: "#EFECFE", // selected-answer wash
          mid: "#CFC5FB", // borders on violet surfaces
          deep: "#5E40DC", // hover
        },
        // Mint and coral are product colours: illustrations, success and
        // destructive states. They are deliberately absent from the logo and
        // the site chrome, which is navy on cream with violet as the accent.
        mint: { DEFAULT: "#73DDB5", soft: "#E4F8F0" },
        yellow: { DEFAULT: "#FFC857", soft: "#FFF4DE" },
        coral: { DEFAULT: "#FF806F", soft: "#FFEDEA" },
        navy: "#18233A", // headings and body type
        slate: "#4A5568", // secondary type
        muted: "#A3AED0", // tertiary type, icons at rest
        lavender: "#F7F8FC", // cool panel backgrounds
        rule: "#E7EAF6", // every border in the product

        // The page itself is a warm off-white, not white. It's the single
        // biggest reason the reference reads as friendly rather than clinical:
        // white cards lift off it, and the whole product feels lit rather than
        // printed. Cards, inputs and the widget surface stay pure white.
        canvas: "#FFF9F1",
        cream: "#FBF3E6", // warmer band, for hero blobs and soft sections
        peach: "#FDEBD8", // the blush behind illustrations
      },
      fontFamily: {
        sans: [
          "Bricolage Grotesque",
          "Satoshi",
          "DM Sans",
          "Poppins",
          "Avenir Next",
          "Segoe UI",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
      },
      borderRadius: {
        tag: "10px",
        btn: "14px",
        option: "18px",
        card: "24px",
        panel: "28px",
        hero: "32px",
      },
      boxShadow: {
        // Navy-tinted and very soft. Depth without weight.
        soft: "0 1px 2px rgba(27,31,59,0.04), 0 8px 24px -12px rgba(27,31,59,0.10)",
        lift: "0 2px 4px rgba(27,31,59,0.05), 0 18px 40px -18px rgba(27,31,59,0.18)",
        pop: "0 24px 60px -24px rgba(27,31,59,0.28)",
        focus: "0 0 0 3px rgba(91,95,239,0.22)",
      },
      fontSize: {
        // Tight, approachable display sizes (§6).
        display: ["clamp(2.25rem, 3.9vw, 3.25rem)", { lineHeight: "1.06", letterSpacing: "-0.03em" }],
        title: ["clamp(1.75rem, 3vw, 2.5rem)", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
      },
      keyframes: {
        rise: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideIn: {
          "0%": { opacity: "0", transform: "translateX(12px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.45" },
        },
      },
      animation: {
        rise: "rise 320ms cubic-bezier(0.22, 1, 0.36, 1) both",
        slideIn: "slideIn 220ms cubic-bezier(0.22, 1, 0.36, 1) both",
        pulseSoft: "pulseSoft 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
