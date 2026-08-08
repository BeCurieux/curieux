/**
 * Central brand configuration.
 *
 * "52 Weekends" is a WORKING NAME and will probably change before launch.
 * Nothing customer-facing may hard-code it — not a page, not an email, not a
 * Stripe description, not an alt attribute. Everything reads from here, and
 * everything here can be overridden by environment variables at deploy time,
 * so a rename is a config change rather than a refactor.
 *
 * There is a test (tests/unit/brand.test.ts) that greps the source tree for
 * stray literals. If you hard-code the name, it fails. That is the point.
 */

/** Reads a public env var, falling back to a working-name default. */
function envOr(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

export const PRODUCT_NAME = envOr(process.env.NEXT_PUBLIC_PRODUCT_NAME, "52 Weekends");

export const PRODUCT_TAGLINE = envOr(
  process.env.NEXT_PUBLIC_PRODUCT_TAGLINE,
  "You get 52 weekends a year. We’ll make them count."
);

export const PRODUCT_DOMAIN = envOr(process.env.NEXT_PUBLIC_PRODUCT_DOMAIN, "52weekends.com");

export const SUPPORT_EMAIL = envOr(
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL,
  `hello@${PRODUCT_DOMAIN}`
);

/**
 * Canonical site URL. Used for magic-link redirects, Stripe return URLs,
 * email links and Open Graph tags — so it must be absolute and origin-only.
 */
export const SITE_URL = envOr(
  process.env.NEXT_PUBLIC_SITE_URL,
  `https://${PRODUCT_DOMAIN}`
).replace(/\/+$/, "");

/**
 * The two promises the whole product is measured against (brief §1).
 * Kept here because marketing copy, emails and the app all repeat them and
 * they must never drift apart.
 */
export const PRODUCT_PROMISE = PRODUCT_TAGLINE;
export const PRODUCT_PROMISE_SECONDARY = "Every Thursday, your weekend is already planned.";

/** One-line description for meta tags, email footers and Stripe. */
export const PRODUCT_DESCRIPTION =
  "One genuinely good weekend, planned around your energy, budget, weather and the people you’re with — delivered every Thursday.";

/** Sender identity for transactional email. */
export const EMAIL_FROM = envOr(process.env.EMAIL_FROM, `${PRODUCT_NAME} <hello@${PRODUCT_DOMAIN}>`);

/** Convenience bundle for passing brand into templates and server components. */
export const brand = {
  name: PRODUCT_NAME,
  tagline: PRODUCT_TAGLINE,
  promiseSecondary: PRODUCT_PROMISE_SECONDARY,
  description: PRODUCT_DESCRIPTION,
  domain: PRODUCT_DOMAIN,
  supportEmail: SUPPORT_EMAIL,
  siteUrl: SITE_URL,
  emailFrom: EMAIL_FROM,
} as const;

export type Brand = typeof brand;

/** Absolute URL builder — never hand-concatenate SITE_URL elsewhere. */
export function url(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
