import type { Metadata, Viewport } from "next";
import { resolveOrigin } from "@/lib/origin";
import { display, sans } from "./fonts";
import "./globals.css";
import "./brand.css";
import "./shop.css";

export const metadata: Metadata = {
  metadataBase: new URL(resolveOrigin()),
  title: "popuup",
  description: "Make a shop in a sentence.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
