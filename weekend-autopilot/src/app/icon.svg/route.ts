import { PRODUCT_NAME } from "@/config/brand";

/**
 * App icon.
 *
 * A typographic mark generated from the brand config rather than a designed
 * logo, because the product name is still provisional (see src/config/brand.ts)
 * and committing a logo file would be the one asset a rename could not reach.
 * Two initials on the brand green: quiet, and correct whatever we end up called.
 */
export function GET() {
  const initials = PRODUCT_NAME.split(/\s+/)
    .map((word) => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#22503F"/>
  <text x="256" y="256" text-anchor="middle" dominant-baseline="central"
        font-family="Georgia, 'Iowan Old Style', serif" font-size="220" fill="#FBF8F3">
    ${initials}
  </text>
</svg>`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
