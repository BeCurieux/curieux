/**
 * Signed image URLs for the image proxy.
 *
 * The browser draws product photos onto a canvas to encode the video, and a
 * canvas that has drawn a cross-origin image without CORS headers refuses to
 * be read. So photos come through our own origin. The signature means the
 * proxy only fetches images an import actually found, rather than being an
 * open relay for any URL on the internet.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export function signImage(url: string, secret: string): string {
  return createHmac("sha256", secret).update(url).digest("base64url").slice(0, 32);
}

export function verifyImage(url: string, sig: string, secret: string): boolean {
  const want = Buffer.from(signImage(url, secret));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}

export function proxiedImage(url: string, secret: string): string {
  const q = new URLSearchParams({ u: url, s: signImage(url, secret) });
  return `/api/image?${q}`;
}
