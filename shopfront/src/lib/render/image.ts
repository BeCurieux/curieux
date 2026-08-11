/**
 * Asking the CDN for the right photograph.
 *
 * This is the least glamorous half of "flatter mediocre product photography"
 * and probably the more effective one. A merchant's catalogue is full of
 * 2400px studio exports; dropping one into a 170px card on a phone is slow,
 * and it also looks *worse* — browser downscaling of a large JPEG oversharpens
 * exactly the compression artefacts and dust the photo was hiding at size.
 *
 * Shopify's CDN resamples properly if you ask. So we ask, and we never touch a
 * URL whose resizing convention we do not know.
 */

import type { IngestedImage } from "@/lib/ingest/types";

/** Widths a phone-first grid actually renders at, times a 2x screen. */
export const CARD_WIDTHS = [180, 260, 360, 520, 720] as const;
export const HERO_WIDTHS = [480, 720, 1080, 1440, 1920] as const;

const SHOPIFY_CDN = /(^|\.)cdn\.shopify\.com$/i;

/** True when we know how to ask this host for a size. */
export function isResizable(url: string): boolean {
  try {
    const parsed = new URL(url);
    return SHOPIFY_CDN.test(parsed.hostname) || parsed.pathname.includes("/cdn/shop/");
  } catch {
    return false;
  }
}

export function sizedImageUrl(url: string, width: number): string {
  if (!isResizable(url)) return url;
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("width", String(Math.round(width)));
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * A srcset, or nothing.
 *
 * Returning undefined rather than a single-entry srcset matters: a srcset the
 * browser cannot choose within is just a longer attribute, and on an
 * unresizable host every entry would be the same file at five widths.
 */
export function srcSetFor(url: string, widths: readonly number[]): string | undefined {
  if (!isResizable(url)) return undefined;
  return widths.map((width) => `${sizedImageUrl(url, width)} ${width}w`).join(", ");
}

export interface ImageAttrs {
  src: string;
  srcSet?: string;
  sizes?: string;
  width?: number;
  height?: number;
  alt: string;
}

/**
 * Everything an `<img>` needs.
 *
 * `alt` is deliberately not invented. Storefronts almost never set it, and a
 * made-up description of a photograph nobody read is the same class of
 * fabrication as a made-up price — so it falls back to the product's own
 * title, which is a fact.
 */
export function imageAttrs(
  image: IngestedImage | undefined,
  { widths, sizes, alt }: { widths: readonly number[]; sizes: string; alt: string },
): ImageAttrs | null {
  if (!image) return null;
  const largest = widths[widths.length - 1] ?? 1080;
  const srcSet = srcSetFor(image.url, widths);
  return {
    src: sizedImageUrl(image.url, largest),
    ...(srcSet ? { srcSet, sizes } : {}),
    ...(image.width ? { width: image.width } : {}),
    ...(image.height ? { height: image.height } : {}),
    alt: image.alt?.trim() || alt,
  };
}
