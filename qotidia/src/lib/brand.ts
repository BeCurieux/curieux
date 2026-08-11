// The name, in one place.
//
// It was a string literal in a dozen files, and the rename from "Ordinary
// Tuesday" left two of them behind: the cover imprint in the test fixtures
// still said the old name months after the product had changed. Nothing
// caught it because nothing asserted on the imprint — the tests passed while
// building a book branded with a name that no longer existed.
//
// The imprint is the one that matters most. It is printed on the foot of the
// cover of a physical object that sits on a shelf for twenty years, and it
// is the hardest thing in the product to correct after the fact.

export const BRAND = "Qotidia" as const;

/**
 * How the name is set in our own typography: lowercase.
 *
 * Applied only to type we wrote — the wordmark, the cover, our headings.
 * Never to a quotation, a parent's note or a transcript. See houseCase() in
 * lib/pdf/html.ts, which enforces the same rule for the book.
 */
export const WORDMARK = "qotidia" as const;

/** What goes on the foot of a printed cover. */
export const IMPRINT = BRAND;

/** The sender name on email, and the actor in the activity log. */
export const SENDER = BRAND;

/**
 * The line, set lowercase like the wordmark.
 *
 * It was "You live it. We help you keep it." — which described a service.
 * This describes the thing itself, which is what a parent is actually
 * deciding about.
 */
export const TAGLINE = "the everyday, kept." as const;

/**
 * One sentence, for when the tagline is too short to explain anything.
 *
 * The three verbs are the product's actual engine and are in the order it
 * runs in: notice, ask, remember. See lib/prompts/engine.ts for the asking
 * and answerQuestion() for the remembering that closes the loop.
 */
export const ONE_LINER =
  "A private place that notices, remembers and preserves the little things " +
  "that make up a life — then turns each year into a beautiful book.";

/**
 * Where this app is served from.
 *
 * Here for the same reason the name is: it was written out twice, in
 * robots.ts and in the email templates, each with its own fallback. Two
 * copies of a host is two answers to the same question, and the one that
 * gets it wrong is invisible — a canonical URL pointing somewhere else, or
 * an email whose links go to a domain we do not own.
 *
 * It matters more than most settings because of what reads it. Stripe's
 * return URLs, every link in every email, the sitemap and the canonicals —
 * and the QR code in lib/listen/qr.ts, which is *printed into the hardcover*.
 * A wrong host there is not a deploy away from fixed; it is on paper, on a
 * shelf, for twenty years.
 *
 * A function rather than a constant so it is read when it is used: a build
 * that inlines the wrong value at import time is the failure this guards.
 */
export const homeUrl = (): string =>
  process.env.NEXT_PUBLIC_APP_URL ?? "https://qotidia.com";
