// The launch check: `npm run launch:check`
//
// Run it with production's values before launch (SPEC.md → Build order,
// step 9; the checklist is docs/LAUNCH.md). It checks:
//
//   - content: no page or email copy still `draft: true`, no placeholder
//     lessons, the Hype Check word lists are the founder's
//   - GST: not mentioned anywhere, and no Stripe tax option is set
//   - environment: every variable set, live Stripe keys, https addresses,
//     no test stand-ins
//   - database (when the Supabase values are set): Stripe price ids written
//     back, an admin, lessons seeded
//
// Exits 1 if anything blocks launch. `--content` checks only content and
// GST (no environment needed).
//
//   vercel env pull .env.production.local --environment=production
//   npx tsx --env-file=.env.production.local scripts/launch-check.ts

import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  checkContent,
  checkDatabase,
  checkEnv,
  checkGst,
  type DatabaseState,
  type Finding,
} from "../src/lib/launch/check";

const root = path.resolve(import.meta.dirname, "..");
const contentOnly = process.argv.includes("--content");

async function readDatabase(): Promise<DatabaseState | string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return "Supabase values not set; database not checked.";
  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const [products, admins, lessons] = await Promise.all([
    db.from("products").select("tier, stripe_price_id_aud, stripe_price_id_usd"),
    db.from("admins").select("user_id", { count: "exact", head: true }),
    db.from("lessons").select("id", { count: "exact", head: true }),
  ]);
  const error = products.error ?? admins.error ?? lessons.error;
  if (error) return `Couldn't read the database: ${error.message}`;
  return {
    products: products.data ?? [],
    admins: admins.count ?? 0,
    lessons: lessons.count ?? 0,
  };
}

const findings: Finding[] = [...checkContent(root), ...checkGst(root)];
if (!contentOnly) {
  findings.push(...checkEnv(process.env));
  const db = await readDatabase();
  if (typeof db === "string") findings.push({ area: "database", level: "fail", message: db });
  else findings.push(...checkDatabase(db));
}

const AREAS: Record<Finding["area"], string> = {
  content: "Content",
  gst: "GST and tax",
  env: "Environment",
  database: "Database",
};
const areas = contentOnly
  ? (["content", "gst"] as const)
  : (["content", "gst", "env", "database"] as const);
for (const area of areas) {
  const here = findings.filter((f) => f.area === area);
  console.log(`\n${AREAS[area]}: ${here.some((f) => f.level === "fail") ? "NOT READY" : "ok"}`);
  for (const f of here) console.log(`  ${f.level === "fail" ? "✗" : "!"} ${f.message}`);
}
const blocking = findings.filter((f) => f.level === "fail").length;
console.log(
  blocking
    ? `\n${blocking} thing${blocking === 1 ? "" : "s"} to fix before launch.`
    : "\nReady to launch.",
);
process.exit(blocking ? 1 : 0);
