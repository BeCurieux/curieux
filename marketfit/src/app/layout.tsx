/**
 * The embedded app's document. App Bridge and Polaris web components come from
 * Shopify's CDN as script tags in the head — how Shopify documents adding them
 * to an app not built on its template, and the same as tildie/. App Bridge
 * reads the client ID from the meta tag.
 */

import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export const metadata = { title: "MarketFit" };

export default function RootLayout({ children }: { children: ReactNode }) {
  const apiKey = process.env.SHOPIFY_API_KEY ?? "";
  return (
    <html lang="en">
      <head>
        <meta name="shopify-api-key" content={apiKey} />
        {/* eslint-disable-next-line @next/next/no-sync-scripts -- App Bridge must load before the app runs. */}
        <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" />
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="https://cdn.shopify.com/shopifycloud/polaris.js" />
      </head>
      <body>{children}</body>
    </html>
  );
}
