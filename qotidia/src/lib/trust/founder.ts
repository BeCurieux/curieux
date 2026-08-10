// Who answers when you write in.
//
// Until now: nobody, visibly. There was exactly one mailto in the entire
// product and it was the sign-off on the promise page. A parent locked out of
// their child's archive at nine at night had no page to go to, which is a
// worse trust problem than any of the ones the privacy work has been solving
// — those are about what we might do wrong, and this one is about what
// happens next.
//
// ## What a one-person company can honestly promise
//
// Not much, and that is the point. The temptation is the language of a
// support organisation — "our team", "24/7", "priority support" — and every
// word of it would be false. What is actually true here is unusually good and
// unusually rare, so it is worth saying plainly instead: one person reads
// every email, that person wrote the code, and there is nobody above them to
// escalate to.
//
// The last part is a limitation stated as a limitation. A promise page that
// only lists strengths is an advertisement.
//
// ## The name
//
// FOUNDER.name is deliberately empty in the repository and must be filled in
// by the person it describes. Nothing here invents one: a made-up human on a
// page whose entire purpose is that a real human answers would be the exact
// failure the page exists to prevent. Until it is set, the page signs off the
// way /promise already does — truthfully, and without a fabricated person.

import { SUPPORT_ACCESS_HOURS } from "@/lib/family/support";
import { BRAND } from "@/lib/brand";
import { countOf } from "@/lib/words";

export const FOUNDER = {
  /**
   * The real first name of the person who answers. Set this.
   *
   * Empty means the page says "the person who built Qotidia", which is true
   * and impersonal. A name is better — it is the whole difference between
   * writing to a company and writing to somebody — but a wrong one is much
   * worse than none, so this stays blank until its owner fills it in.
   */
  name: "",
  /** Where in the world the working day is, because the promise is in days. */
  timezone: "Australia (AEST/AEDT)",
} as const;

/** How the sign-off reads, with or without a name configured. */
export const signedBy = () => FOUNDER.name || `the person who built ${BRAND}`;

/** Subject of a sentence: "Ada reads every one" / "The person who wrote it reads every one". */
export const whoReads = () => FOUNDER.name || "The person who wrote it";

/**
 * How long a reply takes.
 *
 * Two tiers, because one number would be either a lie or useless. Somebody
 * locked out of their archive and somebody wondering about paper stock are
 * not asking the same question, and a single "within three days" makes the
 * first person's day much worse to make the second's marginally clearer.
 *
 * Business days, and said so. "24 hours" from a one-person company means
 * "24 hours unless it is Saturday", and a family finding that out on Saturday
 * has learned something about how carefully we choose our words.
 */
export const REPLY = {
  urgentDays: 1,
  ordinaryDays: 3,
} as const;

/** What counts as the fast tier. Concrete, so nobody has to guess. */
export const URGENT = [
  "You can’t get in",
  "Something you added has gone missing",
  "A payment or an order has gone wrong",
  "A book is at the printer and something is wrong with it",
];

export interface Undertaking {
  heading: string;
  text: string;
}

export const SUPPORT_PROMISE: Undertaking[] = [
  {
    heading: "A person reads it",
    text: "Every reply is written by a human being. There is no chatbot, no ticket number, and nothing that answers you before a person has read what you wrote.",
  },
  {
    heading: "It is the person who built it",
    text: `The same person who wrote the code answers the email. That cuts both ways and you should know both halves: you will never be handed between departments, and there is nobody above ${signedBy()} to escalate to.`,
  },
  {
    heading: "We reply even when the answer is no",
    text: `Every email gets an answer within ${countOf(REPLY.ordinaryDays, "business day")}, and the urgent kinds within ${countOf(REPLY.urgentDays, "business day")}. If something can’t be fixed, or won’t be for months, you get told that instead of being left with an open thread.`,
  },
  {
    heading: "We don’t need to look inside to help",
    text: `Almost everything can be sorted out without anybody opening your archive. If a problem genuinely can’t be, we ask — you grant it yourself, it expires after ${SUPPORT_ACCESS_HOURS} hours, and the database refuses to hold a grant longer than a week however it is created.`,
  },
  {
    heading: "Support never edits your archive",
    text: "Nothing in your family’s record is changed, added or removed on your behalf. If something needs deleting, you delete it; we will tell you where the button is.",
  },
  {
    heading: "If it’s our fault, we say so",
    text: "A bug is called a bug. You will not be told an outage was scheduled maintenance, or that something we broke is how it was always meant to work.",
  },
];

/**
 * The bit that is a commitment rather than a control, said as one.
 *
 * The consent record and the activity log are real and checkable. Whether
 * anybody here looks without one is, in the end, a promise — the service
 * credentials that run the product can read any row, as they can at every
 * company of this kind. Implying that the database prevents what is actually
 * prevented by conduct would be a more sophisticated version of the badge
 * row the trust strip refuses to be.
 */
export const HONEST_LIMIT =
  "Two of these are enforced by the software and the rest are promises kept " +
  "by a person. Granting access is a real record you can read in your " +
  "activity log, and the database will not hold a grant open longer than a " +
  "week. That nobody looks without asking you first is a commitment, not a " +
  "mechanism — anybody telling you their database prevents their own staff " +
  "from reading it is telling you something else about themselves.";
