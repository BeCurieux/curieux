/**
 * A shop, rendered.
 *
 * Step 4 replaces this route with a public URL per shop backed by Supabase.
 * What it will not replace is the two arguments below it: a `ShopConfig` and a
 * catalogue to resolve against. Keeping the loader in one place is what makes
 * that swap a change to this file and nothing else.
 */

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Shop } from "@/components/shop/Shop";
import { loadShop } from "@/lib/render/store";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }): Promise<Metadata> {
  const shop = await loadShop((await params).key).catch(() => null);
  if (!shop) return { title: "Not found" };
  return {
    title: shop.config.brand.tagline
      ? `${shop.config.brand.name} — ${shop.config.brand.tagline}`
      : shop.config.brand.name,
    ...(shop.config.meta.audience ? { description: shop.config.meta.audience } : {}),
  };
}

export default async function ShopPage({ params }: { params: Promise<{ key: string }> }) {
  const shop = await loadShop((await params).key).catch(() => null);
  if (!shop) notFound();
  return <Shop config={shop.config} catalogue={shop.catalogue} ingestedAt={shop.ingestedAt} />;
}
