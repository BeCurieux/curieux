// How a family pays.
//
// This module changes a decision that was written down deliberately, so it
// says why rather than quietly replacing it.
//
// The original rule was "one price, one transaction: you pay for a book, you
// get a book" — no subscription, because a subscription is what Storyworth,
// Chatbooks and Qeepsake sell and the difference was the point. That rule was
// right about the danger and wrong about the shape. The danger is selling a
// subscription that delivers nothing: paying every month for an app that is
// a list of your own photographs. The shape was wrong because asking A$199
// up front for an object that arrives in twelve months is the hardest
// version of this sale, and it makes the eleven months in between feel like
// waiting rather than keeping.
//
// So there are two ways to pay and they are genuinely different products:
//
//   One-off — this year's book, once. Nothing recurring. For someone who
//   wants the object and not a relationship.
//
//   Monthly — the archive is live all year and each year's book is included
//   while you are a member. The book stops being the thing you are waiting
//   for and becomes the thing a year of keeping produces.
//
// Three rules keep the monthly plan honest, and they are the whole reason
// this module is policy rather than two numbers in a config file.

/** Cents, so nothing here ever meets a floating-point rounding error. */
export const PLAN_PRICES = {
  /** Charged once. This year's book, and no recurring anything. */
  oneOffAud: () => Number(process.env.BOOK_PRICE_AUD ?? 19900),
  /** Charged monthly. Includes each year's book while a member. */
  monthlyAud: () => Number(process.env.MONTHLY_PRICE_AUD ?? 1900),
};

export type PlanId = "one_off" | "monthly";

/**
 * What a year of the monthly plan costs against buying once.
 *
 * A$228 against A$199 — deliberately more, not less. Monthly is a financing
 * convenience and a live service for the eleven months a one-off customer
 * gets nothing, and pricing it below the one-off would make the one-off
 * pointless while teaching customers that waiting is cheaper.
 */
export function yearOfMonthly(): number {
  return PLAN_PRICES.monthlyAud() * 12;
}

// ------------------------------------------------------------- rule one
//
// Leaving never costs you your memories.

/**
 * What a family keeps when they stop paying.
 *
 * Everything, for ever, readable and exportable. They simply cannot add to
 * it until they come back.
 *
 * This is not generosity, it is the only position consistent with the rest
 * of the product. A company that says "their childhood isn't content" and
 * then holds a four-year-old's photographs behind a lapsed card has said two
 * things and meant the second one. It is also, incidentally, the best
 * win-back mechanism available: an archive someone can still open is an
 * archive they can be reminded of.
 *
 * The storage cost of honouring this is a few cents per family per month.
 */
export const ACCESS_AFTER_CANCELLING = {
  read: true,
  export: true,
  addMemories: false,
  invite: false,
  /** Nothing is ever deleted for non-payment. Only on an explicit request. */
  deletedForNonPayment: false,
} as const;

export const CANCELLATION_PROMISE =
  "Everything you've kept stays yours to read and to download, for as long " +
  "as you want it — we never delete a family's archive for not paying. You " +
  "just can't add anything new until you come back.";

// ------------------------------------------------------------- rule two
//
// Months already paid are not lost.

/**
 * What months already paid are worth against buying this year's book.
 *
 * Someone who pays for five months and stops has given us A$95 and received
 * no object. Keeping that money and also charging them A$199 for the book
 * their own year produced is the kind of thing that is legal, defensible in
 * a support email, and remembered for ever.
 *
 * Capped at the book price so it can discount but never pay out — this is
 * credit toward a thing, not a balance we owe.
 */
export function creditForMonthsPaid(monthsPaid: number): number {
  const months = Math.max(0, Math.floor(monthsPaid));
  return Math.min(months * PLAN_PRICES.monthlyAud(), PLAN_PRICES.oneOffAud());
}

/** What a lapsed member pays to get the book their year produced. */
export function bookPriceAfterCancelling(monthsPaid: number): number {
  return Math.max(0, PLAN_PRICES.oneOffAud() - creditForMonthsPaid(monthsPaid));
}

/** How long that credit lasts. Long enough to be real, not for ever. */
export const CREDIT_VALID_DAYS = 365;

// ----------------------------------------------------------- rule three
//
// A book is only included if the membership actually covered the year.

/**
 * Months of membership before a year's book is included.
 *
 * Not twelve. Someone who joins in March for a child whose year closes in
 * June has paid four months and should still get that book — they used the
 * product for the part of the year that was left, and telling them to wait
 * a further eight is how a family decides this was a mistake.
 *
 * Six is the line: half the year, paid for. Below it the book is offered at
 * the credited price instead, which is the same money by a different route
 * and reads as an offer rather than a refusal.
 */
export const MONTHS_FOR_INCLUDED_BOOK = 6;

export function bookIncluded(monthsPaidThisYear: number): boolean {
  return monthsPaidThisYear >= MONTHS_FOR_INCLUDED_BOOK;
}

/**
 * What a member is charged when their year closes.
 *
 * Zero when the membership covered enough of the year. Otherwise the
 * one-off price less what they have already paid — never the full price,
 * because they have been paying.
 */
export function chargeAtYearEnd(input: {
  plan: PlanId;
  monthsPaidThisYear: number;
}): number {
  if (input.plan === "one_off") return PLAN_PRICES.oneOffAud();
  if (bookIncluded(input.monthsPaidThisYear)) return 0;
  return bookPriceAfterCancelling(input.monthsPaidThisYear);
}

// --------------------------------------------------------------- words

export interface PlanCopy {
  id: PlanId;
  name: string;
  price: string;
  cadence: string;
  blurb: string;
  includes: string[];
  /** The thing this plan is worse at. Named, not hidden. */
  caveat: string;
}

/**
 * Both plans described, including what each is worse at.
 *
 * A comparison table where one column has no downside is an advert, and a
 * parent reading it knows that. Naming the real trade-off is what makes the
 * rest of the table believable.
 */
export function planCopy(): PlanCopy[] {
  const monthly = PLAN_PRICES.monthlyAud() / 100;
  const oneOff = PLAN_PRICES.oneOffAud() / 100;
  return [
    {
      id: "monthly",
      name: "Keep the year",
      price: `A$${monthly}`,
      cadence: "a month",
      blurb:
        "The archive is open all year, everyone you invite can add to it, and each year's book is included.",
      includes: [
        "Their book every year, printed and posted",
        "Everyone you invite can add photos and memories",
        "What was happening a year ago, every day",
        "Stop any time — everything you've kept stays yours",
      ],
      caveat: `Over a year this costs A$${(monthly * 12).toFixed(0)}, which is more than buying the book once.`,
    },
    {
      id: "one_off",
      name: "Just the book",
      price: `A$${oneOff}`,
      cadence: "once",
      blurb: "This year's book, printed and posted. Nothing recurring.",
      includes: [
        "One hardcover book of this year",
        "The digital copy, yours to keep",
        "No subscription and no card kept on file",
      ],
      caveat:
        "You'll be asked again next year, and the archive is read-only in between.",
    },
  ];
}
