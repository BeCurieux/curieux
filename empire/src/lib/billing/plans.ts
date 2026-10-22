import type { ModuleKey } from "@/lib/domain/modules";
import { expandLibrary } from "@/content/catalogue";
import type { Entitlement } from "@/lib/domain/records";

// What each kind of account may do, in one place. The pricing page, the
// studio's locks and the generation service all read from here, so what we
// promise and what we enforce can't drift apart.
//
// The Launch Pack is a one-time purchase. What it buys permanently is the
// work: everything generated stays saved, editable, copyable and exportable
// for as long as the account exists. What it does not buy is unlimited AI:
// each pack includes a fixed allowance of generations, stated up front.

/** The founder's exact refund wording. Use this constant; never paraphrase it. */
export const REFUND_POLICY = "Full refund within 14 days of purchase, no questions asked.";

/** Where consumer rights are mentioned, they follow the refund sentence as their own sentence. */
export const CONSUMER_RIGHTS = "This is on top of your rights under consumer law.";

/** Seller details, as on every Her Little Empire product. */
export const SELLER = {
  name: "Her Little Empire",
  abn: "38 813 430 864",
  country: "Australia",
  email: "hello@herlittleempire.com",
} as const;

export const LAUNCH_PACK = {
  name: "Shopify Launch Pack",
  priceLabel: process.env.NEXT_PUBLIC_LAUNCH_PACK_PRICE_LABEL ?? "US$49",
  refundDays: 14,
  generationsPerPack: 80,
  productsPerPack: 10,
  profilesPerPack: 1,
} as const;

export const FREE = {
  generations: 4,
  profiles: 1,
  products: 1,
  modules: ["brand_blueprint", "theme_prompts"] as ModuleKey[],
} as const;

/** Per account per rolling hour, on any plan: stops runaway clicking and scripts. */
export const HOURLY_GENERATION_LIMIT = 15;

export interface Access {
  plan: "free" | "launch_pack";
  packs: number;
  profiles: number;
  productsPerProfile: number;
  generations: number;
  modules: readonly ModuleKey[] | "all";
  /** Brand Blueprint shows a preview and theme prompts show one sample. */
  preview: boolean;
  canExport: boolean;
  /** Existing Her Little Empire products she owns, bundles expanded (content/catalogue.ts slugs). */
  library: string[];
  /** Owns the Income Fit Test (directly or in a bundle): the full FIT Finder report. */
  fitFinder: boolean;
}

export function accessFrom(entitlements: Entitlement[]): Access {
  const active = entitlements.filter((e) => e.status === "active");
  const packs = active.filter((e) => e.productType === "launch_pack").length;
  // A bundle counts as owning everything in it.
  const library = expandLibrary(
    active
      .filter((e) => e.productType.startsWith("library:"))
      .map((e) => e.productType.slice("library:".length)),
  );
  if (packs === 0) {
    return {
      plan: "free",
      packs: 0,
      profiles: FREE.profiles,
      productsPerProfile: FREE.products,
      generations: FREE.generations,
      modules: FREE.modules,
      preview: true,
      canExport: false,
      library,
      fitFinder: library.includes("income-fit-test"),
    };
  }
  return {
    plan: "launch_pack",
    packs,
    profiles: LAUNCH_PACK.profilesPerPack * packs,
    productsPerProfile: LAUNCH_PACK.productsPerPack,
    generations: LAUNCH_PACK.generationsPerPack * packs,
    modules: "all",
    preview: false,
    canExport: true,
    library,
    fitFinder: library.includes("income-fit-test"),
  };
}

export function moduleAllowed(access: Access, module: ModuleKey): boolean {
  return access.modules === "all" || access.modules.includes(module);
}

export type Refusal =
  | { reason: "locked"; message: string }
  | { reason: "allowance"; message: string }
  | { reason: "hourly"; message: string }
  | { reason: "platform"; message: string };

/**
 * May this account run one more generation right now?
 *
 * `used` counts successful generations ever (the allowance is lifetime, per
 * pack); `lastHour` counts attempts in the past hour, failures included.
 */
export function mayGenerate(
  access: Access,
  module: ModuleKey,
  used: number,
  lastHour: number,
): Refusal | null {
  if (!moduleAllowed(access, module)) {
    return {
      reason: "locked",
      message: "This studio is part of the Launch Pack. Your saved work stays put if you upgrade.",
    };
  }
  if (used >= access.generations) {
    return {
      reason: "allowance",
      message:
        access.plan === "free"
          ? "You've used your free generations. Everything you made is saved — the Launch Pack unlocks the rest."
          : "You've used this pack's generations. All your work stays saved, editable and exportable.",
    };
  }
  if (lastHour >= HOURLY_GENERATION_LIMIT) {
    return {
      reason: "hourly",
      message: "That's a lot of generating in one hour. Have a breather and try again shortly.",
    };
  }
  return null;
}
