/**
 * The browser suite, kept separate from `pnpm test` on purpose.
 *
 * It needs three things the unit suite does not: a Chromium binary, a Next dev
 * server, and about a minute. Folding it into the default run would make the
 * fast feedback loop slow and would turn "no browser on this machine" into a
 * red suite, so it gets its own config, its own script, and a skip when
 * CHROMIUM_PATH is unset.
 */

import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    include: ["tests/visual/**/*.test.ts"],
    environment: "node",
    // One browser, one dev server, one shop — shared by every file rather than
    // rebuilt per worker.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 180_000,
  },
});
