import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// The guardrail + cadence suites are the build-breakers (CLAUDE.md §Testing).
// They run against the pure engine in src/lib with no Next/Supabase/network.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Playwright specs live under e2e/ and are run separately.
    exclude: ['e2e/**', 'node_modules/**'],
  },
});
