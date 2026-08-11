// The questions people actually ask before paying.
//
// Not a help centre. Eight objections, in the order they occur to somebody
// deciding — what is this, is it safe, what happens if I stop, what if I am
// not the sort of person who keeps up with things — answered plainly and
// without a sales voice.
//
// Two rules.
//
// **Answers that restate a promise quote the promise.** Where the product
// has a written commitment — what happens when you cancel, what the credit
// is worth, how many months count toward a book — the answer is built from
// the same constant the billing code runs on. A FAQ that paraphrases a
// policy is a second copy of that policy, and the second copy is the one
// that goes stale.
//
// **No answer is longer than it needs to be.** A four-paragraph answer to
// "is it private" reads as a company with something to explain.

import {
  CANCELLATION_PROMISE,
  MONTHS_FOR_INCLUDED_BOOK,
  PLAN_PRICES,
} from "@/lib/billing/plans";
import { aud } from "@/lib/billing/money";
import { BRAND } from "@/lib/brand";

export interface Question {
  q: string;
  a: string;
  /** Shown on the pricing page as well as the landing page. */
  money?: boolean;
}

export function questions(): Question[] {
  return [
    {
      q: `What is ${BRAND}, exactly?`,
      a:
        "A private place to put your child's photographs, the things they " +
        "say, and the small moments you'd otherwise lose. Through the year " +
        "it notices what's actually going on — what they're carrying " +
        "everywhere, what they've stopped saying — and at the end of it, all " +
        "of that becomes one hardcover book, printed and posted to you.",
    },
    {
      q: "Do I have to keep up with it?",
      a:
        "No. Some families add something most days; others empty a year of " +
        "camera roll in one evening in November. Both make a book. We'll ask " +
        "you a small question now and then, and ignoring it is a perfectly " +
        "normal thing to do.",
    },
    {
      q: "Who can see it?",
      a:
        "Only the people you invite, one at a time — there are no share " +
        "links and nothing is ever public or searchable. Photographs are " +
        "encrypted in transit and at rest. We don't sell anything, we don't " +
        "advertise, and your family's photographs are never used to train an " +
        "AI model.",
    },
    {
      q: "Does AI write the book?",
      a:
        "It helps choose and arrange — which photographs belong together, " +
        "what a chapter is about, what to ask you. It never invents a " +
        "memory. Every line in the book traces back to something your family " +
        "actually put there, and you read the whole thing before it prints.",
    },
    {
      q: "Can grandparents add things?",
      a:
        "Yes, and it's free — invite as many people as you like. You decide " +
        "who can add and who can only read, and anything they add waits for " +
        "you before it goes in the book.",
    },
    {
      q: "When does the book arrive?",
      a:
        "You read it first. Nothing goes to a printer until you say so, and " +
        "once you do it's about two weeks to your door. Extra copies for " +
        "grandparents ride along on the same print run and come to you, so " +
        "you can write in them before passing them on.",
      money: true,
    },
    {
      q: "What if I stop paying?",
      // The promise itself, not a paraphrase of it.
      a: CANCELLATION_PROMISE,
      money: true,
    },
    {
      q: "What if I join halfway through the year?",
      a:
        `Then you pay for the months you're here. Once ${MONTHS_FOR_INCLUDED_BOOK} ` +
        "months of membership have covered a year, that year's book is " +
        "included at no extra cost. Below that, everything you've already " +
        `paid comes off the ${aud(PLAN_PRICES.oneOffAud())} book price — ` +
        "we don't charge twice for the same year.",
      money: true,
    },
  ];
}

/** The subset a pricing page should carry: the ones about money. */
export const moneyQuestions = () => questions().filter((q) => q.money);
