/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Modules import each other as `./x.js`, which is what TypeScript's ESM
  // resolution, `tsx` and `vitest` expect. Webpack needs telling that `.js`
  // may be a `.ts` file — the same arrangement as tildie/.
  webpack(config) {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
