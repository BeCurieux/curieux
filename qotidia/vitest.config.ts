import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    // `import.meta.dirname` rather than `__dirname`: this package is ESM, and
    // __dirname only worked because Vite's bundling config loader supplied it.
    // The native loader does not, and it is due to become the default — which
    // would break the alias, and with it every test that imports from "@/".
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
