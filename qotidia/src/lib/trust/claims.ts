// What we tell a parent at the moment they hand over their child's photographs.
//
// The strip sits under the drop zone because that is where the decision
// actually happens. Everything before it is browsing; this is the first
// irreversible-feeling act, and the sentence a nervous parent needs is not on
// a page they have to go and find.
//
// ## The rules these claims are written under
//
//   **Every claim links to where it is done, not where it is described.**
//   That is the whole difference between a trust strip and a badge row. A
//   badge says "encrypted"; this says "encrypted" and takes you to the page
//   that explains exactly what travels and what doesn't. "Delete means
//   delete" takes you to the button. A claim that can only be read about is
//   marketing wearing a padlock.
//
//   **One list, two renderings.** The privacy page already carried a grid of
//   five pillars written separately from this. Two hand-maintained lists of
//   privacy claims is how a company ends up making a promise in one place it
//   has quietly stopped keeping in the other. Both now read from here.
//
//   **Nothing that cannot be shown.** No "military-grade encryption", no
//   "bank-level security", no "100% secure", no certification shields for
//   audits nobody has done. tests/trust.test.ts enforces that against the
//   whole source tree rather than against this file, because the failure mode
//   is somebody adding it somewhere else in a year. The honest position is
//   the one the privacy page already takes: we collect less, we guard it, we
//   never sell it, and you can leave with everything.
//
//   **Six, and short.** A strip of twelve reassurances reads as a company
//   with something to be nervous about.

export interface Claim {
  id: string;
  /** Two or three words. It has to survive being read sideways. */
  title: string;
  /** One line, in the product's own voice. */
  blurb: string;
  /** Where a person can go and see it for themselves. */
  href: string;
  /** What they will find when they get there. Used as the link's title. */
  proof: string;
  /** Shown in the strip under the drop zone. */
  atUpload: boolean;
}

export const CLAIMS: Claim[] = [
  {
    id: "private",
    title: "Private by default",
    blurb: "Nothing is public. There are no public links, and nothing here is searchable.",
    // The activity log rather than the explainer. A parent who can read
    // "Grandpa opened Florence's 2027 album on Tuesday" does not have to be
    // told the archive is private — they can watch it being private, and
    // they would see it if it stopped.
    href: "/settings/privacy#activity",
    proof: "Every time anyone opened it, including us",
    atUpload: true,
  },
  {
    id: "not-training",
    title: "Not training data",
    // Deliberately the stronger, narrower claim. "We don't train on your
    // photos" is table stakes and slightly evasive; the photographs never
    // leave for a model at all, which is the thing a parent is actually
    // asking about.
    blurb: "Your photographs are never sent to an AI service. Only words are, and no model trains on them.",
    href: "/privacy",
    proof: "Follow a photograph through the system, step by step",
    atUpload: true,
  },
  {
    id: "checkable",
    title: "AI you can check",
    blurb: "Every line we write about your family opens to the memories it was counted from.",
    href: "/privacy",
    proof: "What the system reads, and what it never decides",
    atUpload: true,
  },
  {
    id: "export",
    title: "Export anytime",
    blurb: "Everything, at original quality, in folders you can open without us.",
    href: "/settings/privacy#export",
    proof: "The button that does it",
    atUpload: true,
  },
  {
    id: "delete",
    title: "Delete means delete",
    // "Within 30 days" rather than "within a month", and the number is the
    // one in lib/privacy/erase.ts — tests/trust.test.ts fails if the two
    // ever disagree. A retention period stated loosely in one place and
    // precisely in another is how a privacy claim quietly becomes false.
    blurb: "Gone from live systems at once, and off the backups within 30 days.",
    href: "/settings/privacy#delete",
    proof: "The button that does it",
    atUpload: true,
  },
  {
    id: "encrypted",
    title: "Encrypted",
    // In transit and at rest, and that is all it says. The temptation here
    // is an adjective, and every available adjective is a lie.
    blurb: "In transit and at rest, backups included. Images are served as links that expire in minutes.",
    href: "/privacy",
    proof: "Where your photographs actually go",
    atUpload: true,
  },
  {
    id: "no-ads",
    // Not in the strip — six is the limit — but it belongs in the full set,
    // and it is the only one of these that is structural rather than a
    // policy we could quietly change.
    title: "No ads, ever",
    blurb: "You pay for a book, so your family is the customer rather than the inventory.",
    href: "/privacy",
    proof: "Why the business could not work the other way",
    atUpload: false,
  },
];

/** The six shown under the drop zone. */
export const AT_UPLOAD = CLAIMS.filter((c) => c.atUpload);

/**
 * The one sentence under the strip.
 *
 * It exists because a row of six reassurances, on its own, reads as a
 * company protesting. The line that makes it read as a statement instead is
 * the offer to go and check — which is only worth making because every
 * claim above it links somewhere a person can.
 */
export const CHECKABLE = "Every one of these is a link to where it happens, not a badge.";
