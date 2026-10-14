// Single source of truth for every brand string in the product (brief §1).
//
// The codename was Quotio; the product is MEKMI. This file is the only place
// the name appears in prose — if you add a user-visible string containing it,
// it belongs here. The logo is not a string: see components/brand/.

export const brand = {
  /** Product name, as shown in the header, titles and the "Made with" badge. */
  name: "MEKMI",

  /** One-line positioning, used in metadata and the footer. */
  tagline: "Make your website do things.",

  /** Hero headline, split so one half can be coloured (§6). */
  heroHeadline: { lead: "Tiny interactive tools,", accent: "beautifully made." },

  heroSupport:
    "Calculators and quizzes people are happy to finish.",

  /** The three promises under the hero CTA. */
  heroProofPoints: ["No code", "Beautiful by default", "Embed anywhere"],

  /** Shown on free-plan widgets; the top of the growth loop (§22). */
  badgeLabel: "Made with",

  /** Marketing site domain, used in copy only. */
  domain: "mekmi.app",

  /** Support address shown on billing/settings screens. */
  supportEmail: "hello@mekmi.app",

  /**
   * Who is legally operating this.
   *
   * Empty on purpose. Terms and a privacy policy have to name a real entity
   * and a real jurisdiction to be worth anything, and neither can be guessed
   * from a codebase — so rather than shipping "[COMPANY NAME]" to production,
   * the legal pages read these and say plainly that they are unfinished until
   * they're filled in (§41).
   *
   * Fill all three before taking money from anybody.
   */
  legal: {
    /** Registered name, e.g. "Curieux Ltd". */
    entity: "",
    /** Registered address, one line. */
    address: "",
    /** Governing law, e.g. "England and Wales". */
    jurisdiction: "",
  },
} as const;

/** Whether the legal pages can name a real operator (§41). */
export function legalEntityKnown(): boolean {
  return Boolean(brand.legal.entity && brand.legal.address && brand.legal.jurisdiction);
}

/**
 * Absolute origin for hosted pages and embed snippets.
 * Set NEXT_PUBLIC_APP_URL in production; localhost is a sane dev default.
 */
export function appUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

/** Public URL of a published widget's hosted page (§21). */
export function hostedUrl(slug: string): string {
  return `${appUrl()}/w/${slug}`;
}

/** Public URL of the bare, frameable widget (§21). */
export function embedUrl(slug: string): string {
  return `${appUrl()}/embed/${slug}`;
}
