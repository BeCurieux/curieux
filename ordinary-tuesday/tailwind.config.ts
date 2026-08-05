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
      colors: {
        ink: "#191A17",     // warm near-black, for type
        paper: "#EDEDE7",   // overcast
        card: "#F7F7F2",    // raised surfaces
        boot: "#D99A16",    // the yellow boots
        slate: "#4E5558",   // wet footpath
        stone: "#7A7D77",   // secondary type
        rule: "#D8D8D0",    // hairlines
      },
      fontFamily: {
        display: ["Iowan Old Style", "Palatino Linotype", "Palatino", "Book Antiqua", "Georgia", "serif"],
        body: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
