import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { brand, PRODUCT_DESCRIPTION, PRODUCT_NAME, SITE_URL } from "@/config/brand";
import "./globals.css";

/**
 * Self-hosted via next/font: no request leaves the page for a typeface, which
 * keeps the Thursday-morning open fast on a phone with one bar of signal.
 */
const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  axes: ["SOFT", "WONK"],
});

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-sans" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${PRODUCT_NAME} — ${brand.tagline}`, template: `%s · ${PRODUCT_NAME}` },
  description: PRODUCT_DESCRIPTION,
  applicationName: PRODUCT_NAME,
  openGraph: {
    title: `${PRODUCT_NAME} — ${brand.tagline}`,
    description: PRODUCT_DESCRIPTION,
    siteName: PRODUCT_NAME,
    type: "website",
  },
  // Installable PWA (§36).
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: PRODUCT_NAME },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#FBF8F3",
  width: "device-width",
  initialScale: 1,
  // The app is a reading surface; pinch-zoom stays available.
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU" className={`${fraunces.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
