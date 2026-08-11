import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./shop.css";

export const metadata: Metadata = {
  title: "Shopfront",
  description: "Make a shop in a sentence.",
};

/**
 * `viewport-fit=cover` so a full-bleed hero actually reaches the edges of a
 * notched phone, and no maximum-scale — pinch-zoom is the accessibility
 * affordance people actually use on product photographs.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
