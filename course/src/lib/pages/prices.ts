import "server-only";
import { headers } from "next/headers";
import { currencyFor, formatMoney, type Currency } from "@/lib/calc/format";
import { REFUND_DAYS, type Product } from "@/lib/commerce/plan";
import { serviceClient } from "@/lib/supabase/server";

// Prices for the public pages, in the visitor's currency: AUD in Australia
// (and when we can't tell), USD elsewhere, from Vercel's geo header
// (SPEC.md → Currency). Checkout decides again from her profile.

export async function visitorCurrency(): Promise<Currency> {
  const country = (await headers()).get("x-vercel-ip-country");
  return currencyFor(country);
}

export async function catalogue(): Promise<Product[]> {
  const { data, error } = await serviceClient()
    .from("products")
    .select(
      "id, slug, name, tier, price_aud_cents, price_usd_cents, stripe_price_id_aud, stripe_price_id_usd, active, places_total, places_sold",
    )
    .returns<Product[]>();
  if (error) throw new Error(`products: ${error.message}`);
  return data;
}

const whole = (cents: number, currency: Currency) => {
  const text = formatMoney(cents / 100, currency);
  return text.endsWith(".00") ? text.slice(0, -3) : text;
};

export function priceTokens(products: Product[], currency: Currency): Record<string, string> {
  const cents = (slug: string) => {
    const p = products.find((x) => x.slug === slug);
    return p ? (currency === "AUD" ? p.price_aud_cents : p.price_usd_cents) : 0;
  };
  const founding = products.find((p) => p.tier === "founding");
  return {
    "price:module-0": whole(cents("module-0"), currency),
    "price:course": whole(cents("course"), currency),
    "price:course-with-credit": whole(cents("course") - cents("module-0"), currency),
    "price:founding": whole(cents("founding"), currency),
    "price:benchmark-pack": whole(cents("benchmark-pack"), currency),
    founding_places: founding?.places_total
      ? String(Math.max(0, founding.places_total - founding.places_sold))
      : "",
    refund_days: String(REFUND_DAYS),
  };
}

export { whole as formatWhole };
