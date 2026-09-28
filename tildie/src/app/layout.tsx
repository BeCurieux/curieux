/**
 * The embedded app's document. App Bridge and Polaris come from Shopify's CDN
 * as plain script tags in the head, which is how Shopify documents adding them
 * to an app that is not built on its template. App Bridge reads the client ID
 * from the meta tag.
 *
 * [unverified] The Polaris script path: the docs index dropped the URL from
 * every snippet. This is the unversioned entry point the docs name as the
 * default, at the same CDN path as App Bridge. Stage 4 confirms both.
 */

import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export const metadata = { title: "Tildie" };

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
