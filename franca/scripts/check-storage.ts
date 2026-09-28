/**
 * `pnpm check:storage` — the app's storage code against the real Supabase
 * project, end to end, before any merchant depends on it.
 *
 * Stage 3 checked the SQL live and the TypeScript against a fake; nothing has
 * yet run the one through the other, because the build environment cannot
 * reach Supabase and cannot read a secret key. This does, from any machine
 * that can: every store operation, through the same code the app runs, on a
 * throwaway shop that is redacted at the end whether the checks pass or not.
 *
 *   SUPABASE_URL=https://kqygkaerzyfcveblmhcw.supabase.co \
 *   SUPABASE_SECRET_KEY=sb_secret_… \
 *   FRANCA_TOKEN_KEY=… \
 *   pnpm check:storage
 */

import { parseTokenKey } from "../src/server/crypto.js";
import { createSupabaseStore } from "../src/server/supabaseStore.js";
import type { Installation } from "../src/server/store.js";
import { scanProduct } from "../src/shopify/catalogue.js";
import type { ProductCopy } from "../src/shopify/admin/products.js";

const SHOP = "franca-storage-check.myshopify.com";

const url = process.env["SUPABASE_URL"];
const secretKey = process.env["SUPABASE_SECRET_KEY"];
const tokenKey = process.env["FRANCA_TOKEN_KEY"];
if (!url || !secretKey || !tokenKey) {
  console.error("Set SUPABASE_URL, SUPABASE_SECRET_KEY and FRANCA_TOKEN_KEY. See SHOPIFY-APP.md, stage 4.");
  process.exit(2);
}

const store = createSupabaseStore({
  url,
  secretKey,
  tokenKeys: { current: parseTokenKey(tokenKey) },
  transport: (u, init) => fetch(u, init),
});

function product(n: number, text: string, updatedAt: string): ProductCopy {
  return {
    gid: `gid://shopify/Product/${n}`,
    legacyId: String(n),
    handle: `check-${n}`,
    title: `Check ${n}`,
    status: "ACTIVE",
    url: `https://example.com/products/check-${n}`,
    updatedAt,
    text,
  };
}

const results: Array<[string, boolean]> = [];
function check(name: string, ok: boolean) {
  results.push([name, ok]);
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}`);
}

async function main() {
  const now = new Date();
  const installation: Installation = {
    shop: SHOP,
    state: "active",
    token: {
      accessToken: "shpat_storage_check",
      refreshToken: "shprt_storage_check",
      accessExpiresAt: new Date(now.getTime() + 3600_000),
      refreshExpiresAt: new Date(now.getTime() + 90 * 86400_000),
      scopes: ["read_products"],
    },
    markets: ["AU", "US"],
    lastKnownPlan: "growth",
    installedAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  await store.putInstallation(installation);
  const back = await store.getInstallation(SHOP);
  check("installation round-trips, tokens sealed and opened", back?.token.accessToken === "shpat_storage_check" && back.lastKnownPlan === "growth");

  const clean = scanProduct(product(1, "A gentle cleanser for everyday use.", "2026-09-28T08:00:00Z"), ["AU", "US"]);
  const loud = scanProduct(product(2, "Clinically proven to clear acne in 7 days.", "2026-09-28T08:00:00Z"), ["AU", "US"]);
  await store.putCatalogue(SHOP, {
    scannedAt: now.toISOString(),
    jurisdictions: ["AU", "US"],
    packVersions: clean.result.packVersions,
    products: [clean, loud],
    summary: { products: 2, byBand: { clear: 1, review: 0, rework: 1 }, unread: 0, badges: 1, weakest: null },
  });
  const catalogue = await store.getCatalogue(SHOP);
  check("full scan stored and read back, summary recomputed", catalogue?.summary.products === 2 && catalogue.summary.badges === 1);

  const newer = scanProduct(product(2, "A gentle cleanser for everyday use.", "2026-09-28T10:00:00Z"), ["AU", "US"]);
  check("newer product copy accepted", await store.putProduct(SHOP, newer));
  const older = scanProduct(product(2, "Clinically proven.", "2026-09-28T07:00:00Z"), ["AU", "US"]);
  check("older product copy refused", !(await store.putProduct(SHOP, older)));

  await store.markStale(SHOP, clean.product.gid);
  const stale = (await store.getCatalogue(SHOP))?.products.find((p) => p.product.gid === clean.product.gid);
  check("stale product keeps its score and loses its mark", stale?.stale === true && stale.badge === false);

  await store.removeProduct(SHOP, clean.product.gid);
  check("removed product gone", (await store.getCatalogue(SHOP))?.summary.products === 1);

  const first = await store.deliveries.claim("storage-check", now, SHOP);
  const second = await store.deliveries.claim("storage-check", now, SHOP);
  await store.deliveries.settle("storage-check", "done", now);
  const third = await store.deliveries.claim("storage-check", now, SHOP);
  check("delivery ledger: claimed, then in flight, then done", first.claimed && !second.claimed && !third.claimed && third.reason === "already-processed");
}

try {
  await main();
} catch (error) {
  check(`unexpected error: ${error instanceof Error ? error.message : String(error)}`, false);
} finally {
  await store.redactShop(SHOP);
  check("throwaway shop redacted", (await store.getInstallation(SHOP)) === null);
}

const failed = results.filter(([, ok]) => !ok).length;
console.log(failed === 0 ? "\nStorage works end to end." : `\n${failed} check(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
