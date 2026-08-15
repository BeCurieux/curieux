import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // next/font is a build-time transform, not a module: imported directly
      // it exports an object and calling it throws. A page that sets its own
      // face is otherwise untestable, and the class name it returns is not
      // what any of these tests are about.
      "next/font/local": path.resolve(import.meta.dirname, "tests/helpers/next-font.ts"),
    },
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
