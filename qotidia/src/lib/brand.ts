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
