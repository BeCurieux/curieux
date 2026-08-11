// The promise, numbered and dated.
//
// /privacy already explains how the product works — six questions, the route
// a photograph takes, what we don't collect. This is a different document and
// the difference is the whole point of it: an explanation describes what is
// currently true, and a promise is a thing a family can hold us to later.
//
// Four properties make the second kind of document real. Without them it is
// an explanation in a nicer font.
//
//   **Numbered.** You can count them, cite one, and notice if it goes.
//   "We take your privacy seriously" cannot be cited.
//
//   **Dated.** Each carries the day it was first published. A promise with no
//   date cannot be shown to have been broken.
//
//   **Append-only.** A promise is never edited and never deleted. If we ever
//   stop keeping one, it stays on the page with the date we withdrew it and
//   the reason — struck through, in public, permanently. This is the property
//   that costs something, which is why it is the one worth having: a page a
//   company can quietly rewrite is a page that promises nothing.
//   tests/promise.test.ts fingerprints every published wording, so changing
//   one silently fails the build.
//
//   **Consequential.** It says what we do when we break it, not only what we
//   intend. Promise 8 is the only one on this page that is about failure, and
//   it is the one most likely to matter.
//
// Everything here has to be something the code already does. A promise the
// implementation does not keep is worse than no promise, because it is a
// specific, dated, numbered lie. Each one below names where it lives.

import { BACKUP_EXPIRY_DAYS } from "@/lib/privacy/erase";
import { LIVES_FOR_DAYS } from "@/lib/share/policy";
import { SUPPORT_ACCESS_HOURS } from "@/lib/family/support";

/** How long we take to tell an affected family, once we have confirmed it. */
export const TELL_YOU_WITHIN_DAYS = 7;

export interface Undertaking {
  /** Stable, never reused, never renumbered. */
  n: number;
  /** Three or four words, for scanning. */
  heading: string;
  /** The undertaking itself, in the second person. */
  text: string;
  /** Where in the product this is actually done. */
  kept: string;
  /** ISO date first published. */
  since: string;
  /**
   * Set only if we ever stop keeping it. The promise stays on the page.
   * There is no code path that removes an entry from this list.
   */
  withdrawn?: { on: string; why: string };
}

const FIRST = "2026-08-10";

export const UNDERTAKINGS: Undertaking[] = [
  {
    n: 1,
    heading: "Never sold, never advertised against",
    text: "We will never sell your family’s information, share it with data brokers, or show you an advertisement. You pay us for a book, which is the only reason we can say this and mean it.",
    kept: "There is no advertising or analytics-brokerage code in this product.",
    since: FIRST,
  },
  {
    n: 2,
    heading: "Never training data",
    text: "We will never use your photographs, recordings or writing to train an AI model — ours or anybody else’s. Your photographs are never sent to an AI service at all; only words are, and our provider is contractually barred from training on them.",
    kept: "The image never leaves your private storage. See the route a photograph takes.",
    since: FIRST,
  },
  {
    n: 3,
    heading: "Private unless you say otherwise",
    text: `Your archive is private by default and is never listed, indexed or searchable. The one thing you can send outside the family is a single story, to one person, on a link that stops working after ${LIVES_FOR_DAYS} days and that you can pull back at any moment.`,
    kept: "lib/share/policy.ts, and robots.txt refuses the route twice over.",
    since: FIRST,
  },
  {
    n: 4,
    heading: "We do not look",
    text: `Nobody here browses family archives. If you ask us for help with something we cannot solve without looking, you grant that access yourself, it expires on its own after ${SUPPORT_ACCESS_HOURS} hours, and it is written into an activity log we cannot edit and you can read.`,
    kept: "Support access is granted by you, in your settings, and expires without our involvement.",
    since: FIRST,
  },
  {
    n: 5,
    // The central rule of the whole product, and the one nobody else is
    // making. It belongs in the promise rather than only in the code.
    heading: "We never invent a memory",
    text: "The system arranges, counts and asks. It does not write your family’s memories for you, and it will not put words in your child’s mouth. Anything it noticed can be opened to show the memories it was counted from, and anything it got wrong you can correct.",
    kept: "Every observation carries the memories behind it, and shows them on request.",
    since: FIRST,
  },
  {
    n: 6,
    heading: "You can leave with everything",
    text: "At any time, without asking us, you can take every photograph and recording at original quality, every word as you wrote it, and all your books — in ordinary folders that open on any computer without our software.",
    kept: "One button in your archive settings, and no support ticket in the way.",
    since: FIRST,
  },
  {
    n: 7,
    heading: "Delete means delete",
    text: `When you delete your archive it is gone from our live systems immediately and cannot be recovered — not by you and not by us. Encrypted backups roll off within ${BACKUP_EXPIRY_DAYS} days and are never restored except to recover from a failure affecting everyone.`,
    kept: "lib/privacy/erase.ts, and the confirmation is deliberately hard to do by accident.",
    since: FIRST,
  },
  {
    n: 8,
    // The only promise here about failing, and the one most likely to be
    // the one that matters. Deliberately not a promise that nothing will
    // ever go wrong — see "What we won't promise" on the privacy page.
    heading: "If something goes wrong, we tell you",
    text: `If your family’s information is exposed, we will email you within ${TELL_YOU_WITHIN_DAYS} days of confirming it — whether or not the law requires it, in plain words, saying what happened, what of yours was involved, and what we still don’t know. We will not wait for certainty before telling you something is wrong.`,
    kept: "A commitment rather than a code path. It is the one on this page you should judge us on.",
    since: FIRST,
  },
  {
    n: 9,
    heading: "This page does not change quietly",
    text: "We will never edit or delete a promise on this page. If we ever stop keeping one, it stays here struck through, with the date and the reason, and we will email you before a change that reduces what we promise takes effect.",
    kept: "The list is append-only, and a test fails the build if a published wording is edited.",
    since: FIRST,
  },
];

/** The live ones, in order. */
export const KEPT = UNDERTAKINGS.filter((u) => !u.withdrawn);

export interface Change {
  on: string;
  what: string;
  why: string;
}

/**
 * Every change ever made, newest first.
 *
 * The first entry is publication. If this list ever stops growing while the
 * undertakings above change, the page has become the thing it exists not to
 * be.
 */
export const HISTORY: Change[] = [
  {
    on: FIRST,
    what: "First published: nine promises.",
    why: "Written down so they can be held against us rather than restated whenever we are asked.",
  },
];

/** The version, which is simply the date of the most recent change. */
export const AS_AT = HISTORY[0].on;

/**
 * The line about statutory rights.
 *
 * A voluntary promise sits on top of the law; it never replaces it, and a
 * company implying otherwise is doing something worse than making no promise
 * at all. Australian Consumer Law and the Privacy Act give a family rights
 * that nothing on this page can reduce.
 */
export const STATUTORY =
  "Everything here is in addition to the rights you already have under " +
  "Australian Consumer Law and Australian privacy law. Nothing on this page " +
  "reduces them, and if the two ever disagree, the law wins.";
