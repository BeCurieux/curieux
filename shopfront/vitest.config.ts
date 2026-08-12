import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    // The browser suite has its own config and its own script. It needs a
    // Chromium binary and a dev server, neither of which this run has any
    // business requiring.
    exclude: ["tests/visual/**"],
    environment: "node",
  },
});
