import type { Metadata, Viewport } from "next";
import { AnalyticsProvider } from "@/components/analytics-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Ovyko", template: "%s · Ovyko" },
  description: "Everything they do, together.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#F8F6FB",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU">
      <body className="min-h-dvh">
        <AnalyticsProvider />
        {children}
      </body>
    </html>
  );
}
