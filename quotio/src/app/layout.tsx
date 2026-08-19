import type { Metadata, Viewport } from "next";
import { brand } from "@/config/brand";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: `${brand.name} — ${brand.tagline}`, template: `%s · ${brand.name}` },
  description: brand.heroSupport,
};

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/*
          No font link. Bricolage Grotesque is served from this origin — see
          public/fonts/README.md. The widget runtime ends up on other
          people's sites, and a webfont CDN there would mean their visitors'
          browsers talking to a third party we don't control.
        */}
      </head>
      <body>{children}</body>
    </html>
  );
}
