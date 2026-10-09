import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/engine/**", "src/rules/**"],
      // BUILD_BRIEF.md §9: the engine has at least 90% unit coverage.
      thresholds: { lines: 90, branches: 90, functions: 90, statements: 90 },
    },
  },
});
