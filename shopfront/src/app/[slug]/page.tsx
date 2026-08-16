/**
 * A published shop, at the root.
 *
 * `getpopuup.com/kelpandcotton` rather than `/s/kelpandcotton`: this URL goes in
 * an Instagram bio, gets read aloud and gets typed by hand, and a routing
 * prefix in the middle is a syllable spent on our conventions. The price is
 * that every word the app might want later has to be reserved up front, which
 * `slug.ts` does.
 *
 * Static routes beat dynamic ones in Next's matcher, so `/preview` and `/api`
 * resolve before this. That is also the failure mode the reserved list guards:
 * a shop that took a name the app later needed would simply stop resolving one
 * day, with no error anywhere.
 */

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Shop } from "@/components/shop/Shop";
import { defaultStore } from "@/lib/publish/index";

export const dynamic = "force-dynamic";

async function load(slugPromise: Promise<{ slug: string }>) {
  const { slug } = await slugPromise;
  return defaultStore()
    .loadBySlug(slug)
    .catch(() => null);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const shop = await load(params);
  if (!shop) return { title: "Not found" };

  const { brand, meta } = shop.config;
  return {
    title: brand.tagline ? `${brand.name} — ${brand.tagline}` : brand.name,
    ...(meta.audience ? { description: meta.audience } : {}),
    openGraph: {
      title: brand.name,
      ...(brand.tagline ? { description: brand.tagline } : {}),
      type: "website",
    },
  };
}

export default async function PublishedShopPage({ params }: { params: Promise<{ slug: string }> }) {
  const shop = await load(params);
  if (!shop) notFound();

  return (
    <Shop
      config={shop.config}
      catalogue={shop.catalogue}
      ingestedAt={shop.ingestedAt}
      slug={shop.slug}
      creator={shop.creator}
      // Pro removes the badge; nothing else about the page changes with plan.
      badge={shop.plan === "free"}
    />
  );
}
