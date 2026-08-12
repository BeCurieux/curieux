/**
 * The URL a merchant puts in their bio.
 *
 * It is the most public string this system produces and it is very hard to
 * change later — a link in an Instagram bio is copied into places nobody can
 * edit — so it is worth more care than its size suggests.
 *
 * Shops live at the root (`popuup.com/kelpandcotton`) rather than under a
 * prefix. A bio link is read aloud and typed by hand, and `/s/` in the middle
 * of one is a syllable spent on our routing convention. The cost is that every
 * word this app might ever want as a page has to be spoken for up front.
 */

/**
 * Slugs the app cannot give away.
 *
 * Next matches static segments before dynamic ones, so an existing route would
 * quietly win over a shop that had taken its name — the merchant's shop would
 * simply stop resolving one day, with no error anywhere. The list is
 * deliberately longer than the routes that exist today: adding a page later
 * must never require taking a URL back off somebody.
 */
export const RESERVED_SLUGS = new Set([
  // Routes that exist, or obviously will.
  "api", "preview", "admin", "dashboard", "settings", "account", "login", "logout",
  "signup", "signin", "register", "onboarding", "new", "edit", "billing", "upgrade",
  // The product and the company.
  "popuup", "app", "www", "shop", "shops", "store", "stores", "creator", "creators",
  // Marketing pages any product this shape ends up with.
  "about", "pricing", "plans", "terms", "privacy", "legal", "help", "support",
  "docs", "blog", "changelog", "status", "contact", "careers", "press", "examples",
  // Infrastructure and well-known paths.
  "_next", "static", "assets", "cdn", "public", "images", "img", "fonts", "media",
  "favicon.ico", "robots.txt", "sitemap.xml", "manifest.json", "sw.js",
  ".well-known", "health", "healthz", "metrics", "webhooks", "auth", "callback",
  // Reserved because a shop called this would read as ours, not theirs.
  "mail", "email", "sms", "checkout", "cart", "orders", "search",
]);

export const SLUG_MIN = 3;
export const SLUG_MAX = 40;

/** Lowercase letters, digits and single inner hyphens. */
const SHAPE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export interface SlugProblem {
  ok: false;
  reason: string;
}
export type SlugCheck = { ok: true } | SlugProblem;

/**
 * Turn a brand name into a candidate slug.
 *
 * Diacritics are folded rather than stripped, so "Café Lumière" becomes
 * "cafe-lumiere" instead of "caf-lumi-re" — a merchant reading that back would
 * not recognise their own shop.
 */
export function slugify(input: string): string {
  const folded = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    // Ampersand is common enough in shop names to be worth a word.
    .replace(/&/g, " and ")
    .toLowerCase();

  return folded
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, "");
}

export function checkSlug(slug: string): SlugCheck {
  if (slug.length < SLUG_MIN) return { ok: false, reason: `A shop URL needs at least ${SLUG_MIN} characters.` };
  if (slug.length > SLUG_MAX) return { ok: false, reason: `A shop URL can be at most ${SLUG_MAX} characters.` };
  if (!SHAPE.test(slug)) {
    return {
      ok: false,
      reason: "A shop URL can use lowercase letters, numbers and hyphens, and cannot start or end with a hyphen.",
    };
  }
  if (RESERVED_SLUGS.has(slug)) return { ok: false, reason: `"${slug}" is reserved.` };
  // A slug that looks like a file would be ambiguous against a real asset.
  if (/\.[a-z0-9]+$/.test(slug)) return { ok: false, reason: "A shop URL cannot end in a file extension." };
  return { ok: true };
}

export interface AllocateOptions {
  /** Called until it returns false. */
  isTaken: (slug: string) => Promise<boolean>;
  /** How many numbered variants to try before giving up. */
  maxAttempts?: number;
}

/**
 * Find a free slug near the one asked for.
 *
 * Numbered rather than randomised: `kelpandcotton-2` is something a merchant
 * can read down a phone line, and `kelpandcotton-f3a9` is not. The counter
 * starts at 2 because the unsuffixed slug is conceptually the first.
 */
export async function allocateSlug(
  preferred: string,
  { isTaken, maxAttempts = 50 }: AllocateOptions,
): Promise<string> {
  const base = slugify(preferred) || "shop";

  const candidates = [base];
  for (let n = 2; n <= maxAttempts; n++) {
    const suffix = `-${n}`;
    const trimmed = base.length + suffix.length > SLUG_MAX ? base.slice(0, SLUG_MAX - suffix.length) : base;
    candidates.push(`${trimmed.replace(/-+$/g, "")}${suffix}`);
  }

  for (const candidate of candidates) {
    if (checkSlug(candidate).ok !== true) continue;
    if (!(await isTaken(candidate))) return candidate;
  }

  throw new Error(
    `Could not find a free URL near "${base}" after ${maxAttempts} tries. Ask the merchant for one they want.`,
  );
}
