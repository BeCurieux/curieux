"use client";

import type { Picture } from "@/render/draw";

const cache = new Map<string, Promise<Picture>>();

/** Loads a photo once, decoded and ready to draw. Proxied photos are
 *  same-origin and uploads are blob: URLs, so the canvas stays readable. */
export function loadPicture(src: string): Promise<Picture> {
  let p = cache.get(src);
  if (!p) {
    p = new Promise<Picture>((resolve, reject) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => resolve({ source: img, w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => reject(new Error(`Couldn't load ${src}`));
      img.src = src;
    });
    p.catch(() => cache.delete(src));
    cache.set(src, p);
  }
  return p;
}

export async function fontsReady(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  await Promise.all([
    document.fonts.load('800 64px "Inter Variable"'),
    document.fonts.load('700 48px "Inter Variable"'),
    document.fonts.load('600 32px "Inter Variable"'),
  ]).catch(() => undefined);
}
