import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ConsentBanner } from "@/components/consent";

export const metadata: Metadata = {
  title: { default: "Empire Studio — Her Little Empire", template: "%s · Empire Studio" },
  description:
    "Turn your product idea into a coordinated Shopify launch: brand blueprint, Sidekick prompts, product copy, photo briefs, launch marketing and a checklist. Big plans. Real life.",
};

export const viewport: Viewport = { themeColor: "#632B39" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-oxblood focus:px-4 focus:py-2 focus:text-ivory"
        >
          Skip to content
        </a>
        {children}
        <ConsentBanner />
      </body>
    </html>
  );
}
