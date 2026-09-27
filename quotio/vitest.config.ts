import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // See tests/stubs/server-only.ts.
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
  // Some tests import a component module to exercise the real function the
  // pages use rather than a copy of it — `miniFromDocument` sits next to the
  // JSX it feeds. Without this those files transform with the classic
  // runtime and fail on `React is not defined`.
  esbuild: { jsx: "automatic" },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
