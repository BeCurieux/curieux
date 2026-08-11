// What we measure, and everything we refuse to measure with it.
//
// Analytics is where a product like this betrays itself. Everything else in
// the codebase has been careful — the photographs never leave for a model,
// the support view reads through a grant, a private note is private — and
// then somebody adds a script tag and a family's behaviour goes to an
// advertising company, because that is simply what analytics *is* in 2026 and
// nobody thought of it as a privacy decision.
//
// So the standard this module is built to is: **analytics we could publish.**
// If the whole table appeared on the privacy page, nothing in it should
// embarrass us or identify anybody.
//
// Five rules, and each one closes a specific way this goes wrong.
//
//   **Nowhere but our own database.** No Google Analytics, no Segment, no
//   Mixpanel, no hosted Posthog. Promise 1 says we never sell your family's
//   information or show you an advertisement; sending a parent's behaviour to
//   an ad-tech company is that promise broken with extra steps, and it would
//   be broken by an npm install.
//
//   **Server-side only.** No beacon, no pixel, no client script. Every event
//   below already happens inside a server action, so there is nothing to
//   gain from the browser except an IP address we do not want.
//
//   **A closed list.** Not track(name, props). An open API is how a codebase
//   acquires `photo_uploaded {filename: "florence-bath.jpg"}` — nobody
//   decides to do that, it arrives one convenient argument at a time. Adding
//   an event here is a diff somebody reads.
//
//   **No content and no identity.** An event says a memory was kept. Never
//   which one, never what was in it, never whose. No user id, no family id,
//   no memory id, no title, no text, no filename, no IP, no user agent.
//
//   **It expires.** Faster than the archive it describes. A product that
//   tells families it collects less than it could should not keep behavioural
//   data for ever because storage is cheap.
//
// ## The one hard part: funnels without following people
//
// A funnel needs to know two events came from the same person. An identifier
// that does that is an identifier that can follow somebody for ever, which is
// the thing being avoided.
//
// The compromise is a rotating pseudonym: a hash of the user id, a secret
// salt, and the current window. Within a window it links events into a
// funnel; across windows the same person is a different token, so nobody —
// including us — can assemble a history. It cannot be reversed to a user id
// without the salt, and knowing the salt only lets you confirm a guess about
// a user you already named.
//
// The window is set to cover activation, which is the funnel that matters:
// signing up, uploading, seeing the archive notice something, getting a first
// story. All of that happens in days. The year-long path to a book is
// measured by counting cohorts, not by following anybody for a year.

/**
 * Every event this product may record. Alphabetical, so the list reads as a
 * list rather than as a history of what somebody needed on a Tuesday.
 */
export const EVENTS = [
  /** An account was created. The top of the funnel. */
  "signed_up",
  /** A child or household was named — the first act of a real archive. */
  "subject_created",
  /** A batch of photographs arrived. Count of files, never which. */
  "upload_finished",
  /** Something written, said or recorded was kept. */
  "memory_written",
  /** The archive had enough to say something back. */
  "noticing_shown",
  /** A parent answered one of the questions only they can answer. */
  "question_answered",
  /** The first story existed. The moment the product becomes itself. */
  "story_made",
  /** That story was sent to somebody outside the family. */
  "story_shared",
  /** Somebody outside the family added what they remembered. */
  "contribution_received",
  /** The free cap was reached. Where the paywall actually lands. */
  "free_cap_reached",
  /** A membership or a one-off purchase began. */
  "paid",
  /** A membership ended. */
  "stopped_paying",
  /** A book was approved for print, which is the thing being sold. */
  "book_approved",
  /** A family took a copy of everything. */
  "archive_exported",
  /** A family deleted everything. Measured because it must never be hidden. */
  "archive_deleted",
] as const;

export type EventName = (typeof EVENTS)[number];

/**
 * The only extra a numeric event may carry.
 *
 * A single number, and its meaning is fixed per event: how many files were in
 * an upload, how many memories at the moment of noticing. There is
 * deliberately no place to put a string, because every way this goes wrong
 * begins with a place to put a string.
 */
export interface Event {
  name: EventName;
  /** Bounded, so a count cannot become an identifier by being precise. */
  count?: number;
}

/**
 * Fields that must never appear in an analytics row.
 *
 * Checked against the migration and the writer by tests/analytics.test.ts.
 * The list is the specification; the table is an implementation of it.
 */
export const NEVER_RECORDED = [
  "user id",
  "family id",
  "memory id",
  "email address",
  "a child's name",
  "anything a family wrote",
  "file names",
  "IP addresses",
  "user agent or device fingerprint",
  "referrer",
] as const;

/**
 * How long a pseudonym lasts before the same person becomes a different one.
 *
 * Sixty days. Long enough to see a family through signing up, uploading,
 * being told something about their own year and sending it to somebody —
 * which is the whole of the funnel worth optimising. Short enough that
 * nobody can be followed from one book to the next.
 */
export const WINDOW_DAYS = 60;

/**
 * How long events are kept at all.
 *
 * Half a year. Two quarters is enough to tell whether a change helped, and a
 * product that tells families it collects less than it could has no business
 * keeping behavioural data longer than it can use it.
 */
export const KEEP_FOR_DAYS = 180;

/** Which window a moment falls in. Integer, so it is stable and comparable. */
export function windowOf(nowIso: string): number {
  return Math.floor(Date.parse(nowIso) / (WINDOW_DAYS * 86_400_000));
}

/**
 * The funnel, in order.
 *
 * One north star and the steps to it. Named here rather than in the page
 * that draws it, so the question "what are we trying to make happen" has one
 * answer in the codebase — and so a step cannot be quietly dropped from the
 * chart because it looks bad.
 */
export const FUNNEL: { step: EventName; as: string }[] = [
  { step: "signed_up", as: "Signed up" },
  { step: "upload_finished", as: "Put something in" },
  { step: "noticing_shown", as: "Were told something" },
  { step: "story_made", as: "Got a first story" },
  { step: "story_shared", as: "Sent it to somebody" },
  { step: "paid", as: "Paid" },
];

/**
 * The north star.
 *
 * Not signups and not revenue. A family who has sent a story to somebody has
 * received the thing this product is for and has shown it to a person who
 * might want their own — it is the one number that is simultaneously the
 * value delivered and the growth loop.
 */
export const NORTH_STAR: EventName = "story_shared";
