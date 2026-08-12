/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // The image optimiser is off, and that is a design decision rather than a
  // shortcut. Product photographs come from the merchant's own CDN, which
  // already resizes properly when asked — src/lib/render/image.ts does the
  // asking. Putting /_next/image in front of an arbitrary remote host would
  // add a second optimiser, a remotePatterns allowlist that has to be widened
  // for every new merchant, and a proxy hop between the shopper and a photo
  // that was already one request away.
  images: { unoptimized: true },

  serverExternalPackages: ["playwright-core"],
};

export default nextConfig;
