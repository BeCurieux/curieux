import type { ReactNode } from "react";
import "@fontsource-variable/inter";
import "./globals.css";

export const metadata = {
  title: "Reelkit — video ads from your product link",
  description: "Paste an Etsy or Shopify listing and get three short video ads, ready for Reels and TikTok.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
