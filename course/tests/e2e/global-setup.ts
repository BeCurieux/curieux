import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { supabaseEnv } from "../../playwright.config";
import { startFakeResend } from "./fake-resend";
import { FAKE_STRIPE_BASE, startFakeStripe } from "./fake-stripe";

// Before the tests: load /content into the test database (as
// `npm run content:seed` would), start the stand-in Stripe and Resend servers, and run
// the real `npm run stripe:setup` against it so the products have prices.
export default async function globalSetup() {
  const env = {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: supabaseEnv.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SECRET_KEY: supabaseEnv.SUPABASE_SECRET_KEY,
    STRIPE_SECRET_KEY: "sk_test_fake",
    STRIPE_API_BASE: FAKE_STRIPE_BASE,
  };
  execFileSync("npx", ["tsx", "scripts/seed-content.ts"], { stdio: "inherit", env });
  const server = await startFakeStripe("http://localhost:3300/api/webhooks/stripe");
  // Not execFileSync: the fake server runs in this process and must keep
  // answering while the script calls it.
  const { stdout } = await promisify(execFile)("npx", ["tsx", "scripts/stripe-setup.ts"], { env });
  process.stdout.write(stdout);
  const resend = await startFakeResend();
  return async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await new Promise<void>((resolve) => resend.close(() => resolve()));
  };
}
