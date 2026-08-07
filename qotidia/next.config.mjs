/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // The image optimiser is switched off because nothing here uses it.
  //
  // `next/image` appears nowhere in src/ — photographs are served as plain
  // <img> from short-lived signed URLs, because they are private files
  // behind row-level security rather than public assets to be cached at an
  // edge. But the /_next/image endpoint exists whether or not it is used,
  // and Next 14 carries a denial-of-service advisory against it that has no
  // fix inside the 14.x line.
  //
  // Turning it off removes the endpoint's work rather than mitigating it:
  // there is no resizing to exhaust. If this project ever adopts next/image
  // it should move to Next 15 in the same change rather than deleting this.
  images: { unoptimized: true },
  experimental: {
    // Both are Node-only and neither survives bundling: Playwright needs its
    // own browser resolution, and archiver's dependency chain ships an
    // exports map webpack rejects ("default condition should be last").
    serverComponentsExternalPackages: ["playwright-core", "archiver"],
  },
};

export default nextConfig;
