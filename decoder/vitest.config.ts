import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    // The suite never reaches a model or a network. Every test that involves
    // the parse adapter injects its own transport, so a red run here is always
    // about the commit and never about somebody else's uptime.
    environment: "node",
  },
});
