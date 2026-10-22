import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LocalStore } from "@/lib/data/local";
import { GumroadProvider, parsePing } from "@/lib/billing/gumroad";
import { accessFrom } from "@/lib/billing/plans";
import { makeRef } from "@/lib/billing/ref";
import { claimByEmail, claimLicense, handlePing, recheck, type BillingDeps } from "@/lib/billing/service";
import type { BillingProvider, VerifiedSale } from "@/lib/billing/provider";

const SECRET = "test-secret-test-secret-test-secret";

function sale(overrides: Partial<VerifiedSale> = {}): VerifiedSale {
  return {
    externalPurchaseId: "sale-1",
    productType: "launch_pack",
    email: "ava@example.test",
    status: "paid",
    amountCents: 4900,
    currency: "USD",
    licenseKey: "AAAA-BBBB-CCCC-DDDD",
    purchasedAt: new Date().toISOString(),
    ...overrides,
  };
}

class FakeGumroad implements BillingProvider {
  readonly name = "gumroad" as const;
  sales = new Map<string, VerifiedSale>();
  verifyLicense = vi.fn(async (key: string) => [...this.sales.values()].find((s) => s.licenseKey === key) ?? null);
  lookupSale = vi.fn(async (id: string) => this.sales.get(id) ?? null);
  salesForEmail = vi.fn(async (email: string) => [...this.sales.values()].filter((s) => s.email === email));
}

let store: LocalStore;
let gumroad: FakeGumroad;
let deps: BillingDeps;

beforeEach(() => {
  store = new LocalStore(path.join(mkdtempSync(path.join(tmpdir(), "empire-")), "db.json"));
  gumroad = new FakeGumroad();
  deps = { repo: store.system(), provider: gumroad, secret: SECRET };
});

const accessOf = async (userId: string) => accessFrom(await store.forUser(userId).listEntitlements());

describe("Gumroad purchases", () => {
  it("verifies a ping with Gumroad before trusting it", async () => {
    // A forged ping for a sale Gumroad doesn't know about grants nothing.
    expect(await handlePing(deps, { saleId: "forged", productId: null, licenseKey: null, ref: null })).toBeNull();
    // A forged ping that borrows a real licence key for a different sale id also fails.
    gumroad.sales.set("sale-1", sale());
    gumroad.lookupSale.mockResolvedValueOnce(null);
    expect(
      await handlePing(deps, { saleId: "other-sale", productId: null, licenseKey: "AAAA-BBBB-CCCC-DDDD", ref: null }),
    ).toBeNull();
  });

  it("attaches a purchase to the account named by a signed ref", async () => {
    const user = await store.upsertUser("someone-else@example.test");
    gumroad.sales.set("sale-1", sale());
    const result = await handlePing(deps, { saleId: "sale-1", productId: null, licenseKey: null, ref: makeRef(user.id, SECRET) });
    expect(result?.purchase.userId).toBe(user.id);
    expect((await accessOf(user.id)).plan).toBe("launch_pack");
  });

  it("ignores a tampered ref", async () => {
    const user = await store.upsertUser("x@example.test");
    gumroad.sales.set("sale-1", sale());
    const forged = makeRef(user.id, "some-other-secret-some-other-secret");
    const result = await handlePing(deps, { saleId: "sale-1", productId: null, licenseKey: null, ref: forged });
    expect(result?.purchase.userId).toBeNull();
  });

  it("treats duplicate pings as one purchase", async () => {
    const user = await store.upsertUser("ava@example.test");
    gumroad.sales.set("sale-1", sale());
    const ref = makeRef(user.id, SECRET);
    await handlePing(deps, { saleId: "sale-1", productId: null, licenseKey: null, ref });
    await handlePing(deps, { saleId: "sale-1", productId: null, licenseKey: null, ref });
    await Promise.all([1, 2, 3].map(() => handlePing(deps, { saleId: "sale-1", productId: null, licenseKey: null, ref })));
    const entitlements = await store.forUser(user.id).listEntitlements();
    expect(entitlements).toHaveLength(1);
    expect((await accessOf(user.id)).packs).toBe(1);
  });

  it("revokes paid generation on refund, from a ping or the daily recheck", async () => {
    const user = await store.upsertUser("ava@example.test");
    gumroad.sales.set("sale-1", sale());
    await handlePing(deps, { saleId: "sale-1", productId: null, licenseKey: null, ref: makeRef(user.id, SECRET) });
    expect((await accessOf(user.id)).plan).toBe("launch_pack");

    gumroad.sales.set("sale-1", sale({ status: "refunded" }));
    const { refunded } = await recheck(deps);
    expect(refunded).toBe(1);
    expect((await accessOf(user.id)).plan).toBe("free");
    expect((await store.forUser(user.id).listEntitlements())[0]!.status).toBe("refunded");
  });

  it("claims purchases by verified email at sign-in, including older ones Gumroad knows about", async () => {
    gumroad.sales.set("sale-1", sale());
    gumroad.sales.set("sale-2", sale({ externalPurchaseId: "sale-2", productType: "library:income-fit-report", licenseKey: null }));
    // sale-1 arrived by ping before she had an account.
    await handlePing(deps, { saleId: "sale-1", productId: null, licenseKey: null, ref: null });
    const user = await store.upsertUser("ava@example.test");
    const claimed = await claimByEmail(deps, user.id, user.email);
    expect(claimed.map((p) => p.externalPurchaseId).sort()).toEqual(["sale-1", "sale-2"]);
    const access = await accessOf(user.id);
    expect(access.plan).toBe("launch_pack");
    expect(access.library).toEqual(["income-fit-report"]);
  });

  it("keeps an earlier library purchase separate from the Launch Pack", async () => {
    const user = await store.upsertUser("bea@example.test");
    gumroad.sales.set("s", sale({ externalPurchaseId: "s", email: "bea@example.test", productType: "library:brand-in-a-box", licenseKey: null }));
    await claimByEmail(deps, user.id, user.email);
    const access = await accessOf(user.id);
    expect(access.plan).toBe("free");
    expect(access.library).toEqual(["brand-in-a-box"]);
  });

  it("won't let one account claim another's purchase by licence key", async () => {
    const ava = await store.upsertUser("ava@example.test");
    const bea = await store.upsertUser("bea@example.test");
    gumroad.sales.set("sale-1", sale());
    expect((await claimLicense(deps, ava.id, "AAAA-BBBB-CCCC-DDDD")).ok).toBe(true);
    const second = await claimLicense(deps, bea.id, "AAAA-BBBB-CCCC-DDDD");
    expect(second.ok).toBe(false);
    expect((await accessOf(bea.id)).plan).toBe("free");
  });

  it("won't unlock with a refunded licence", async () => {
    const ava = await store.upsertUser("ava@example.test");
    gumroad.sales.set("sale-1", sale({ status: "refunded" }));
    expect((await claimLicense(deps, ava.id, "AAAA-BBBB-CCCC-DDDD")).ok).toBe(false);
  });
});

describe("GumroadProvider", () => {
  it("verifies licences against Gumroad and maps refunds", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(String(init?.body)).toContain("increment_uses_count=false");
      return new Response(
        JSON.stringify({
          success: true,
          purchase: { sale_id: "S1", product_id: "LP", email: "Ava@Example.test", price: 4900, currency: "usd", refunded: true, sale_timestamp: "2026-10-01T00:00:00Z" },
        }),
      );
    });
    const provider = new GumroadProvider({ launchPackProductId: "LP", accessToken: null, fetch: fetchMock as typeof fetch });
    const verified = await provider.verifyLicense("AAAA-BBBB-CCCC-DDDD");
    expect(verified).toMatchObject({ externalPurchaseId: "S1", productType: "launch_pack", email: "ava@example.test", status: "refunded", currency: "USD" });
  });

  it("ignores products it doesn't know", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true, purchase: { sale_id: "S1", product_id: "OTHER", email: "a@b.c" } })));
    const provider = new GumroadProvider({ launchPackProductId: "LP", accessToken: null, fetch: fetchMock as typeof fetch });
    expect(await provider.verifyLicense("AAAA-BBBB-CCCC-DDDD", "OTHER")).toBeNull();
  });

  it("rejects malformed licence keys without calling Gumroad", async () => {
    const fetchMock = vi.fn();
    const provider = new GumroadProvider({ launchPackProductId: "LP", accessToken: null, fetch: fetchMock as typeof fetch });
    expect(await provider.verifyLicense("../../etc")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reads the fields it needs from a ping", () => {
    const form = new URLSearchParams({ sale_id: "S1", product_id: "LP", license_key: "K", "url_params[empire_ref]": "r" });
    expect(parsePing(form)).toEqual({ saleId: "S1", productId: "LP", licenseKey: "K", ref: "r" });
  });
});
