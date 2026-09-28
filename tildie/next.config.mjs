/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // The engine, the card and the Shopify core import each other as `./x.js`,
  // which is what TypeScript's own ESM resolution expects and what `tsx`,
  // `vitest` and `tsc` all accept. Webpack needs telling that `.js` may be a
  // `.ts` file; Turbopack, Next 16's default, has no equivalent yet, so the
  // scripts build with `--webpack`. The alternative was rewriting every import
  // in the engine for the bundler's sake.
  webpack(config) {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
