import type { Metadata } from "next";
import Link from "next/link";
import { Markdown } from "@/components/markdown";
import { DraftNotice } from "@/components/site/header";
import { REFUND_DAYS } from "@/lib/commerce/plan";
import { fillTokens, loadPage } from "@/lib/pages/content";
import { catalogue, formatWhole, priceTokens, visitorCurrency } from "@/lib/pages/prices";

export async function generateMetadata(): Promise<Metadata> {
  const page = await loadPage("pricing");
  return { title: page.title, description: page.description };
}

type TierCopy = Record<string, { summary?: string; includes?: string[] }>;

const ORDER = ["module-0", "course", "founding"] as const;

// The three tiers side by side (SPEC.md → Pages and routes), prices in her
// currency from the database, buttons to /checkout. Checkout re-checks
// everything; this page only shows it.
export default async function PricingPage() {
  const [page, products, currency] = await Promise.all([
    loadPage("pricing"),
    catalogue(),
    visitorCurrency(),
  ]);
  const tokens = priceTokens(products, currency);
  const tiers = (page.data.tiers ?? {}) as TierCopy;
  const price = (cents: number) => formatWhole(cents, currency);
  const cents = (p: (typeof products)[number]) =>
    currency === "AUD" ? p.price_aud_cents : p.price_usd_cents;
  const moduleZero = products.find((p) => p.slug === "module-0");
  const pack = products.find((p) => p.slug === "benchmark-pack");

  return (
    <>
      <DraftNotice draft={page.draft} />
      <main id="main" className="mx-auto w-full max-w-5xl px-5 py-10">
        <h1 className="text-4xl">{String(page.data.headline ?? page.title)}</h1>
        {page.data.intro ? (
          <p className="mt-4 max-w-2xl text-lg">{fillTokens(String(page.data.intro), tokens)}</p>
        ) : null}
        <p className="text-mute mt-2">
          Prices in {currency === "AUD" ? "Australian" : "US"} dollars.
        </p>

        <ul className="mt-8 grid gap-5 md:grid-cols-3">
          {ORDER.map((slug) => {
            const product = products.find((p) => p.slug === slug && p.active);
            if (!product) return null;
            const copy = tiers[slug] ?? {};
            const left =
              product.places_total !== null
                ? Math.max(0, product.places_total - product.places_sold)
                : null;
            const soldOut = left === 0;
            return (
              <li
                key={slug}
                className="border-line bg-paper flex flex-col rounded-2xl border p-6"
                data-testid={`tier-${slug}`}
              >
                <h2 className="text-2xl">{product.name}</h2>
                <p className="text-accent mt-3 text-3xl font-semibold">{price(cents(product))}</p>
                {slug === "course" && moduleZero ? (
                  <p className="text-mute mt-1">
                    {price(cents(product) - cents(moduleZero))} if you already have Module 0
                  </p>
                ) : null}
                {left !== null ? (
                  <p className="mt-1 font-semibold">
                    {soldOut
                      ? "All places taken"
                      : `${left} of ${product.places_total} places left`}
                  </p>
                ) : null}
                {copy.summary ? <p className="mt-4">{fillTokens(copy.summary, tokens)}</p> : null}
                {copy.includes?.length ? (
                  <ul className="mt-4 list-disc space-y-1 pl-5">
                    {copy.includes.map((item) => (
                      <li key={item}>{fillTokens(item, tokens)}</li>
                    ))}
                  </ul>
                ) : null}
                <div className="mt-auto pt-6">
                  {soldOut ? (
                    <Link
                      href="/waitlist"
                      className="border-accent text-accent block rounded-full border px-5 py-3 text-center font-semibold no-underline"
                    >
                      Join the waitlist
                    </Link>
                  ) : (
                    <Link
                      href={`/checkout/${slug}`}
                      className="bg-accent text-on-accent block rounded-full px-5 py-3 text-center font-semibold no-underline"
                    >
                      Buy {product.name}
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {pack ? (
          <p className="mt-8">
            The benchmark pack is {price(cents(pack))} on its own, offered when you buy Module 0,
            and included in the full course and the founding cohort.
          </p>
        ) : null}
        <p className="mt-2">
          Refund any purchase yourself within {REFUND_DAYS} days, no reason needed.
        </p>
        {page.body ? (
          <div className="mt-8">
            <Markdown>{fillTokens(page.body, tokens)}</Markdown>
          </div>
        ) : null}
      </main>
    </>
  );
}
