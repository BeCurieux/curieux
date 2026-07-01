import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'Haunted Wishlist',
  description: 'Saved products that haunt shoppers — cozily, never creepily.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;
  return (
    <html lang="en">
      <head>
        {/* App Bridge (embedded admin). Provides window.shopify.idToken() for
            session-token auth. Inert when the key is unset (local/standalone). */}
        {apiKey ? (
          <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" data-api-key={apiKey} />
        ) : null}
      </head>
      <body>{children}</body>
    </html>
  );
}
