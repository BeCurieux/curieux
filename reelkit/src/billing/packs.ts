/**
 * What credits cost. One credit buys one AI-written set of three ads.
 *
 * Prices live here rather than as Stripe Price objects so a new pack is a
 * code change reviewed like any other, and so the webhook can check that what
 * Stripe says was paid is exactly what this file says the pack costs.
 */

export type Pack = { id: string; credits: number; cents: number; currency: "usd"; name: string };

export const PACKS: readonly Pack[] = [
  { id: "starter", credits: 20, cents: 900, currency: "usd", name: "Starter" },
  { id: "shop", credits: 60, cents: 1900, currency: "usd", name: "Shop" },
  { id: "studio", credits: 200, cents: 4900, currency: "usd", name: "Studio" },
];

/** Must match `public.free_credits()` in the migrations. Shown in the UI. */
export const FREE_CREDITS = 3;

export const packById = (id: unknown) => PACKS.find((p) => p.id === id);

export const priceLabel = (p: Pack) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: p.currency, minimumFractionDigits: p.cents % 100 ? 2 : 0 }).format(
    p.cents / 100,
  );
