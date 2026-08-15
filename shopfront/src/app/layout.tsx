import type { Metadata, Viewport } from "next";
import { display, sans } from "./fonts";
import "./globals.css";
import "./brand.css";
import "./shop.css";

/**
 * Where a relative image in a page's metadata is resolved from.
 *
 * Without this Next resolves `/press/og.jpg` against `http://localhost:3000`
 * and says so in a build warning — which means every share of the landing page
 * unfurls with a broken image, on a page whose entire job is being shared. It
 * reads the same variable `pnpm generate` prints shop URLs with, so a
 * deployment configures its origin once.
 *
 * The fallback is the domain the badge already points at, because a build with
 * no origin set is more likely to be a preview of production than a genuinely
 * different site.
 */
const ORIGIN = process.env.PUBLIC_ORIGIN ?? process.env.NEXT_PUBLIC_ORIGIN ?? "https://popuup.com";

export const metadata: Metadata = {
  metadataBase: new URL(ORIGIN),
  title: "popuup",
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
