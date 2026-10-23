import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // The UI is mostly microcopy; plain apostrophes in JSX text render
      // correctly and are far easier to read and edit than &apos;.
      "react/no-unescaped-entities": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    ".data/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
  ]),
]);
