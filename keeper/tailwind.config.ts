import type { Config } from "tailwindcss";

/**
 * Design language: premium independent publisher.
 * Strong typography, generous white space, restrained colour.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1c1917",
        paper: "#faf8f5",
        clay: "#a8552f",
        sage: "#5f6c5d",
        sand: "#e9e2d6",
      },
      fontFamily: {
        display: ["Georgia", "Times New Roman", "serif"],
        body: ["-apple-system", "Segoe UI", "Helvetica Neue", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
