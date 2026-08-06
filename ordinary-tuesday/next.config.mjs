/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Both are Node-only and neither survives bundling: Playwright needs its
    // own browser resolution, and archiver's dependency chain ships an
    // exports map webpack rejects ("default condition should be last").
    serverComponentsExternalPackages: ["playwright-core", "archiver"],
  },
};

export default nextConfig;
