import { execFileSync } from "node:child_process";
import { supabaseEnv } from "../../playwright.config";

// Load /content into the test database, as `npm run content:seed` would, so
// the course pages have the real placeholder lessons to show.
export default function globalSetup() {
  execFileSync("npx", ["tsx", "scripts/seed-content.ts"], {
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: supabaseEnv.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SECRET_KEY: supabaseEnv.SUPABASE_SECRET_KEY,
    },
  });
}
