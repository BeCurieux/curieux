import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

const alias = {
  "@": path.resolve(import.meta.dirname, "src"),
  "server-only": path.resolve(import.meta.dirname, "tests/stubs/server-only.ts"),
};

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        resolve: { alias },
        test: {
          name: "rls",
          include: ["tests/rls/**/*.test.ts"],
          environment: "node",
          // Talks to the local Supabase stack. Reads .env.local, written by
          // scripts/local-env.sh.
          env: loadEnv("test", process.cwd(), ""),
          testTimeout: 20_000,
          // One shared database: a make-up booked in one file changes what
          // another file's parent can see, so files run one at a time.
          fileParallelism: false,
        },
      },
    ],
  },
});
