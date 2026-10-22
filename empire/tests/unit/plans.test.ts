import { describe, expect, it } from "vitest";
import {
  FREE,
  HOURLY_GENERATION_LIMIT,
  LAUNCH_PACK,
  accessFrom,
  mayGenerate,
} from "@/lib/billing/plans";
import type { Entitlement } from "@/lib/domain/records";

const ent = (overrides: Partial<Entitlement> = {}): Entitlement => ({
  id: "e1",
  userId: "u1",
  productType: "launch_pack",
  paymentProvider: "gumroad",
  externalPurchaseId: "s1",
  status: "active",
  expiresAt: null,
  createdAt: "",
  updatedAt: "",
  ...overrides,
});

describe("access and usage limits", () => {
  it("free accounts get a real but limited preview", () => {
    const access = accessFrom([]);
    expect(access.plan).toBe("free");
    expect(access.preview).toBe(true);
    expect(access.canExport).toBe(false);
    expect(mayGenerate(access, "brand_blueprint", 0, 0)).toBeNull();
    expect(mayGenerate(access, "theme_prompts", 0, 0)).toBeNull();
    expect(mayGenerate(access, "product_listing", 0, 0)?.reason).toBe("locked");
    expect(mayGenerate(access, "brand_blueprint", FREE.generations, 0)?.reason).toBe("allowance");
  });

  it("the Launch Pack unlocks everything with a finite, stated allowance", () => {
    const access = accessFrom([ent()]);
    expect(access.plan).toBe("launch_pack");
    expect(access.generations).toBe(LAUNCH_PACK.generationsPerPack);
    expect(mayGenerate(access, "social_content", LAUNCH_PACK.generationsPerPack - 1, 0)).toBeNull();
    expect(mayGenerate(access, "social_content", LAUNCH_PACK.generationsPerPack, 0)?.reason).toBe(
      "allowance",
    );
  });

  it("packs stack; refunded packs don't count", () => {
    expect(accessFrom([ent(), ent({ id: "e2", externalPurchaseId: "s2" })]).generations).toBe(
      2 * LAUNCH_PACK.generationsPerPack,
    );
    expect(accessFrom([ent({ status: "refunded" })]).plan).toBe("free");
  });

  it("a library purchase doesn't unlock the software", () => {
    const access = accessFrom([ent({ productType: "library:brand-in-a-box" })]);
    expect(access.plan).toBe("free");
    expect(access.library).toEqual(["brand-in-a-box"]);
  });

  it("limits generations per hour on every plan", () => {
    expect(
      mayGenerate(accessFrom([ent()]), "theme_brief", 0, HOURLY_GENERATION_LIMIT)?.reason,
    ).toBe("hourly");
  });
});
