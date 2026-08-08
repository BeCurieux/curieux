import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    // Playwright specs live in tests/e2e and are run by `npm run test:e2e`.
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts", "tests/evals/**/*.test.ts"],
    environment: "node",
  },
});
