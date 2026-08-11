// The First Story Promise.
//
// The hardest sale this product makes is the first one, and it is hard for an
// honest reason rather than a fixable one: a parent is being asked to pay
// before they have seen anything only their own family could have produced.
// Everything on the landing page is a promise about what will happen to
// photographs they have not uploaded yet.
//
// This is the answer to that, and the reason it is worth the money it will
// cost: **if the first thing we make you isn't worth keeping, you get your
// money back.** Not a trial that quietly converts, not a discount, not
// fourteen days from purchase during which nothing is delivered. Thirty days
// from the day we show you something.
//
// ## The four decisions in it
//
//   **The clock starts when we deliver, not when you pay.** A window that
//   opens on payment expires while a family is still uploading, which makes
//   it a formality. If we never make a first story, the window never opens
//   and the refund stands indefinitely — the case where we took money and
//   produced nothing is the one that most deserves it.
//
//   **A refund never costs you the archive.** Asking for money back does not
//   delete anything, and export keeps working. A refund that took the
//   photographs with it would be a trap, and a family who suspected that
//   would never ask.
//
//   **No reason, no form, no retention offer.** One email. Being made to
//   argue for it is how a money-back promise is honoured on paper and
//   withdrawn in practice.
//
//   **A printed book is the one deduction.** Printing and posting a hardcover
//   is a real cost that cannot be reversed, so if one has already been made
//   it is yours to keep and its price comes out. Everything else comes back.
//   Inside thirty days of a first story this will almost never apply, and
//   saying it anyway is better than discovering it in a support email.
//
// ## What this is not
//
// It is not a substitute for the law. Australian Consumer Law gives
// guarantees that no promise on a website can reduce, and a voluntary
// warranty sits on top of them. STATUTORY says so where a customer reads it,
// not in a footer.

import { PLAN_PRICES } from "@/lib/billing/plans";
import { REPLY } from "@/lib/trust/founder";
import { countOf } from "@/lib/words";

/** How long, from the day the first story is ready. */
export const DAYS = 30;

/** Once per family. Stated so it is a bound rather than a discovery. */
export const ONCE_PER_FAMILY = true;

export const HEADLINE = "If the first thing we make you isn’t worth keeping, you get your money back.";

/**
 * The promise, in the order the questions arrive.
 *
 * Written as a list because a paragraph of refund terms is read by nobody,
 * and the whole value of this promise is being understood before the payment
 * rather than after it.
 */
export interface Term {
  what: string;
  detail: string;
}

export const TERMS = (): Term[] => [
  {
    what: `${countOf(DAYS, "day")} from your first story`,
    detail:
      "The clock starts the day we show you the first thing we made from your " +
      "photographs — not the day you paid. If we never make you one, it never " +
      "starts, and you can ask whenever you like.",
  },
  {
    what: "Everything you’ve paid",
    detail:
      "In full. The only deduction is a hardcover that has already been " +
      "printed and posted, which is yours to keep — printing it is a real " +
      "cost and it cannot be un-made. Within a month of a first story there " +
      "almost never is one.",
  },
  {
    what: "You keep the archive",
    detail:
      "A refund deletes nothing. Everything you’ve added stays yours to read " +
      "and to download, exactly as it does if you simply stop paying. You can " +
      "come back to it years later.",
  },
  {
    what: "One email, no reason",
    detail:
      `Say the word and it is done — no form, no survey, and nobody will ` +
      `offer you a discount to stay. It is a payment question, so you get an ` +
      `answer within ${countOf(REPLY.urgentDays, "business day")}.`,
  },
];

/** The one-line version, for a checkout button or a plan card. */
export const SHORT = `${DAYS} days from your first story, or your money back.`;

/**
 * The line about statutory rights.
 *
 * Deliberately not a footnote. A voluntary warranty that appears to replace
 * the law is worse than no warranty, and a customer who has to work out
 * which one they are relying on has been sold something confusing at the
 * moment they were most trusting.
 */
export const STATUTORY =
  "This is in addition to your rights under Australian Consumer Law, which " +
  "no promise on a website can reduce. If the two ever disagree, the law wins.";

/**
 * What a book costs, for the sentence about the one deduction.
 *
 * Read from the price module rather than typed here. A refund term quoting a
 * number the billing code no longer charges is the specific way this kind of
 * promise becomes false.
 */
export const bookCostAud = () => PLAN_PRICES.oneOffAud();
