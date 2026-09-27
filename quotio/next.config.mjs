/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        // The embeddable widget is meant to be framed by other people's sites.
        // Everything else inherits Next's defaults.
        source: "/embed/:path*",
        headers: [{ key: "X-Frame-Options", value: "ALLOWALL" }],
      },
      {
        source: "/embed.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "public, max-age=300" },
        ],
      },
    ];
  },
};

export default nextConfig;
