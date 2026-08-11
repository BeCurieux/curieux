// What the pages are called, in one place.
//
// The pricing page was named in five files — the header, the footer, a
// heading on the landing page, a link under the hero, and its own title tag
// — and renaming it meant finding all five. This project has already been
// bitten by exactly that: the last rename left the old name on the cover
// imprint of the printed book, and nothing noticed for months. See
// brand.ts, and the test that now refuses to let it happen again.
//
// A page name is not brand copy and does not belong in brand.ts, which holds
// the things that go on the object. It is navigation, and it lives here.

/**
 * The pricing page.
 *
 * It was "What it costs", which is an accountant's question asked on the
 * customer's behalf, and it read like an expense claim in a nav bar next to
 * a product about a child's first three years. This names what they get. The
 * prices are still all over the page — being coy about the number is the
 * other way to lose the sale.
 */
export const PRICING = "A book a year";

/**
 * Lowercase, for the places our own display type is set that way — the
 * landing page headings, the footer. Never applied to anything a family
 * wrote; see houseCase() in lib/pdf/html.ts for that rule.
 */
export const PRICING_LOWER = PRICING.toLowerCase();
