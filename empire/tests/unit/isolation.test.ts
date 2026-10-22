import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LocalStore } from "@/lib/data/local";
import { profileFactsSchema } from "@/lib/domain/profile";
import { productInputSchema } from "@/lib/domain/product";

// The local backend must keep customers apart exactly as row level security
// does on Supabase (tests/rls/rls.sql), so nothing passes locally that
// would leak in production.

const facts = profileFactsSchema.parse({
  brandName: "Ava Linen",
  category: "Home and living",
  audience: "New mums",
  productsSummary: "Aprons",
  market: "Australia",
  currency: "aud",
  stage: "prelaunch",
  fulfilment: "physical",
});

describe("local backend isolation", () => {
  it("never shows or changes another customer's data", async () => {
    const store = new LocalStore(path.join(mkdtempSync(path.join(tmpdir(), "empire-")), "db.json"));
    const ava = store.forUser((await store.upsertUser("ava@example.test")).id);
    const bea = store.forUser((await store.upsertUser("bea@example.test")).id);

    const profile = await ava.createProfile(facts);
    const product = await ava.createProduct(
      profile.id,
      productInputSchema.parse({ name: "Apron" }),
    );
    const generation = await ava.addGeneration({
      profileId: profile.id,
      productId: null,
      module: "theme_prompts",
      status: "succeeded",
      source: "edit",
      section: null,
      inputSnapshot: {},
      output: { beforeYouStart: ["x"], prompts: [] } as never,
      warnings: [],
      error: null,
      modelVersion: null,
      profileVersion: 1,
    });

    expect(await bea.listProfiles()).toEqual([]);
    expect(await bea.getProfile(profile.id)).toBeNull();
    expect(await bea.getProduct(product.id)).toBeNull();
    expect(await bea.getGeneration(generation.id)).toBeNull();
    expect(await bea.listGenerations(profile.id)).toEqual([]);
    expect(await bea.listProfileVersions(profile.id)).toEqual([]);
    await expect(
      bea.updateProfile(profile.id, { facts: { ...facts, brandName: "Stolen" } }, "x"),
    ).rejects.toThrow();
    await expect(
      bea.createProduct(profile.id, productInputSchema.parse({ name: "x" })),
    ).rejects.toThrow();
    await expect(bea.addGeneration({ ...generation, profileId: profile.id })).rejects.toThrow();
    await bea.deleteProfile(profile.id);
    await bea.deleteProduct(product.id);
    expect((await ava.getProfile(profile.id))?.brandName).toBe("Ava Linen");
    expect(await ava.getProduct(product.id)).not.toBeNull();
  });

  it("versions profiles and assets instead of overwriting", async () => {
    const store = new LocalStore(path.join(mkdtempSync(path.join(tmpdir(), "empire-")), "db.json"));
    const ava = store.forUser((await store.upsertUser("ava@example.test")).id);
    const profile = await ava.createProfile(facts);
    const updated = await ava.updateProfile(
      profile.id,
      { facts: { ...facts, audience: "Busy mums" } },
      "Edited",
    );
    expect(updated.version).toBe(2);
    const versions = await ava.listProfileVersions(profile.id);
    expect(versions.map((v) => v.facts.audience)).toEqual(["Busy mums", "New mums"]);

    const row = {
      profileId: profile.id,
      productId: null,
      module: "email_sequence" as const,
      status: "succeeded" as const,
      source: "edit" as const,
      section: null,
      inputSnapshot: {},
      output: {} as never,
      warnings: [],
      error: null,
      modelVersion: null,
      profileVersion: 2,
    };
    const v1 = await ava.addGeneration(row);
    const v2 = await ava.addGeneration(row);
    expect([v1.version, v2.version]).toEqual([1, 2]);
  });

  it("deleting an account removes her data and keeps the payment record detached", async () => {
    const store = new LocalStore(path.join(mkdtempSync(path.join(tmpdir(), "empire-")), "db.json"));
    const user = await store.upsertUser("ava@example.test");
    const ava = store.forUser(user.id);
    await ava.createProfile(facts);
    const { purchase } = await store.system().upsertPurchase({
      provider: "gumroad",
      externalPurchaseId: "s1",
      productType: "launch_pack",
      email: user.email,
      status: "paid",
      amountCents: 4900,
      currency: "USD",
      licenseKey: null,
      purchasedAt: new Date().toISOString(),
    });
    await store.system().attachPurchase(purchase.id, user.id);
    await store.system().deleteUser(user.id);
    expect(await ava.listProfiles()).toEqual([]);
    expect(await store.getUser(user.id)).toBeNull();
    expect((await store.system().getPurchase("gumroad", "s1"))?.userId).toBeNull();
  });
});
