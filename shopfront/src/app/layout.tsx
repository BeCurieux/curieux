import type { Metadata, Viewport } from "next";
import { display, sans } from "./fonts";
import "./globals.css";
import "./brand.css";
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
    // The font variables land on <html> rather than on the shop, so the type
    // stacks in render/theme.ts can name them without the renderer having to
    // know how the files are loaded.
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
