import { NextResponse } from "next/server";
import { PRODUCT_DESCRIPTION, PRODUCT_NAME } from "@/config/brand";

/**
 * PWA manifest (§36: installable, and it should feel native on an iPhone).
 *
 * Served from a route rather than a static file so the name comes from brand
 * config — a rename must not leave the installed app on someone’s home screen
 * showing the old working title.
 */
export function GET() {
  return NextResponse.json(
    {
      name: PRODUCT_NAME,
      short_name: PRODUCT_NAME,
      description: PRODUCT_DESCRIPTION,
      start_url: "/app",
      scope: "/",
      display: "standalone",
      background_color: "#FBF8F3",
      theme_color: "#FBF8F3",
      orientation: "portrait",
      icons: [
        { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } }
  );
}
