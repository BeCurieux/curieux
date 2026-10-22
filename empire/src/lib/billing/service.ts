import type { SystemRepo } from "@/lib/data/repo";
import type { Purchase } from "@/lib/domain/records";
import type { BillingProvider, VerifiedSale } from "./provider";
import { readRef } from "./ref";

// Turning verified payments into access. Every path here — a ping, a
// licence key typed in, signing in, the daily recheck — ends in the same
// two steps: record the purchase (idempotently, keyed on the provider's
// sale id) and mirror its status onto the owner's entitlement. So a
// duplicate ping changes nothing, and a refund found by any path revokes
// the Launch Pack's paid generation the same way. Saved work is never
// deleted on refund; it just stops being able to generate more.

export interface BillingDeps {
  repo: SystemRepo;
  provider: BillingProvider;
  secret: string;
}

export type BillingEvent = "created" | "updated" | "refunded";

async function record(deps: BillingDeps, sale: VerifiedSale, userId: string | null) {
  const before = await deps.repo.getPurchase("gumroad", sale.externalPurchaseId);
  let { purchase } = await deps.repo.upsertPurchase({ provider: "gumroad", ...sale });
  if (userId && !purchase.userId) purchase = await deps.repo.attachPurchase(purchase.id, userId);
  const entitlement = await deps.repo.syncEntitlement(purchase);
  const event: BillingEvent = !before
    ? "created"
    : before.status === "paid" && purchase.status !== "paid"
      ? "refunded"
      : "updated";
  return { purchase, entitlement, event };
}

/**
 * A Gumroad ping arrived. Re-verify it, then record it.
 * Returns null when the sale can't be verified (it is then ignored).
 */
export async function handlePing(
  deps: BillingDeps,
  ping: {
    saleId: string | null;
    productId: string | null;
    licenseKey: string | null;
    ref: string | null;
  },
) {
  if (!ping.saleId) return null;
  let sale = await deps.provider.lookupSale(ping.saleId);
  if (!sale && ping.licenseKey) {
    const byKey = await deps.provider.verifyLicense(ping.licenseKey, ping.productId ?? undefined);
    // The key must belong to the sale the ping claims to be about.
    if (byKey?.externalPurchaseId === ping.saleId) sale = byKey;
  }
  if (!sale) return null;
  return record(deps, sale, readRef(ping.ref, deps.secret));
}

/** She typed in a licence key from her Gumroad receipt. */
export async function claimLicense(deps: BillingDeps, userId: string, licenseKey: string) {
  const sale = await deps.provider.verifyLicense(licenseKey);
  if (!sale)
    return {
      ok: false as const,
      message: "We couldn't verify that key. Check it against your Gumroad receipt.",
    };
  const existing = await deps.repo.getPurchase("gumroad", sale.externalPurchaseId);
  if (existing?.userId && existing.userId !== userId) {
    return {
      ok: false as const,
      message:
        "That purchase is already linked to another account. Email us and we'll sort it out.",
    };
  }
  const result = await record(deps, sale, userId);
  if (result.purchase.status !== "paid") {
    return {
      ok: false as const,
      message: "That purchase was refunded, so it can't unlock the pack.",
    };
  }
  return { ok: true as const, ...result };
}

/**
 * On sign-in: attach purchases made with her (verified) email address.
 * Her email is proven by the sign-in link, so matching on it is safe.
 */
export async function claimByEmail(deps: BillingDeps, userId: string, email: string) {
  const claimed: Purchase[] = [];
  for (const purchase of await deps.repo.unclaimedPurchasesFor(email)) {
    const attached = await deps.repo.attachPurchase(purchase.id, userId);
    await deps.repo.syncEntitlement(attached);
    claimed.push(attached);
  }
  // Older Gumroad products may never have pinged us; ask Gumroad directly.
  try {
    for (const sale of await deps.provider.salesForEmail(email)) {
      const existing = await deps.repo.getPurchase("gumroad", sale.externalPurchaseId);
      if (existing?.userId && existing.userId !== userId) continue;
      const { purchase } = await record(deps, sale, userId);
      if (!claimed.some((c) => c.id === purchase.id)) claimed.push(purchase);
    }
  } catch (error) {
    console.error("gumroad email lookup", error instanceof Error ? error.message : error);
  }
  return claimed;
}

/**
 * Daily: re-verify recent paid purchases, so a refund is caught even if
 * its notification never arrived.
 */
export async function recheck(deps: BillingDeps, windowDays = 45) {
  const since = new Date(Date.now() - windowDays * 86_400_000).toISOString();
  let checked = 0;
  let refunded = 0;
  for (const purchase of await deps.repo.purchasesToRecheck(since)) {
    const sale =
      (await deps.provider.lookupSale(purchase.externalPurchaseId)) ??
      (purchase.licenseKey ? await deps.provider.verifyLicense(purchase.licenseKey) : null);
    if (!sale || sale.externalPurchaseId !== purchase.externalPurchaseId) continue;
    checked += 1;
    const result = await record(deps, sale, null);
    if (result.event === "refunded") refunded += 1;
  }
  return { checked, refunded };
}
