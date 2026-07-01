/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The admin app is embedded inside Shopify's iframe; allow it to be framed by
  // the merchant's admin. Storefront push assets are served from the theme
  // extension, so nothing here needs a permissive CSP beyond the frame ancestor.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value:
              "frame-ancestors https://admin.shopify.com https://*.myshopify.com;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
