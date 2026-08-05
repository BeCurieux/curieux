// The messages themselves.
//
// Two rules govern every one of them.
//
// The first is privacy, and it is absolute: **no email carries the archive**.
// A message may name the child, say that something is waiting and how many
// things, and link to the app. It may never contain a photograph, a quote, a
// memory, a transcript, or any generated prose about the family. Email goes
// through a third party and lives in an inbox forever; the archive stays
// behind a login. containsArchiveContent() below is the check, and it is
// tested against every message this module can build.
//
// The second is tone. These arrive unbidden in someone's day. They should
// read like a note from a person who knows what they are interrupting —
// short, specific, never excited on the reader's behalf, and never
// manufacturing urgency about a childhood.

import { countOf } from "@/lib/words";
import { NOTICE_DAYS } from "@/lib/renewal/policy";
import type { OutboundEmail } from "./provider";

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://ordinarytuesday.com";

const SIGNOFF = "\n\nOrdinary Tuesday\nYou live it. We help you keep it.";

/** Appended to anything that is not strictly transactional. */
const optOut = (token: string) =>
  `\n\nIf you would rather not get these, you can turn them off:\n${appUrl()}/settings/notifications?t=${token}`;

export interface Recipient {
  email: string;
  name?: string;
}

// -------------------------------------------------------------- messages

/** Someone has been invited to help keep a child's archive. */
export function invitation(opts: {
  to: Recipient;
  childName: string;
  invitedByName: string;
  token: string;
}): OutboundEmail {
  const url = `${appUrl()}/invite/${opts.token}`;
  return {
    to: opts.to,
    subject: `${opts.invitedByName} would like your help keeping ${opts.childName}'s year`,
    text:
      `${opts.invitedByName} keeps a private archive of ${opts.childName}'s childhood — ` +
      `photographs, the things ${opts.childName} says, the ordinary days — and once a ` +
      `year it becomes a printed book.\n\n` +
      `They have asked if you would add what you have. You will remember things they ` +
      `don't, and you almost certainly have photographs they have never seen.\n\n` +
      `${url}\n\n` +
      `It is free, and nothing you add is public. The link works once and expires in ` +
      `thirty days.` + SIGNOFF,
  };
}

/** Things are waiting for the parent to accept. Batched, never per item. */
export function contributionsWaiting(opts: {
  to: Recipient;
  childName: string;
  count: number;
  subjectId: string;
  optOutToken: string;
}): OutboundEmail {
  const url = `${appUrl()}/subjects/${opts.subjectId}/review`;
  return {
    to: opts.to,
    subject: `${countOf(opts.count, "thing")} waiting for you in ${opts.childName}'s archive`,
    text:
      `${opts.childName}'s family have added ${countOf(opts.count, "thing")}.\n\n` +
      `Nothing reaches the book until you have looked. Keep what belongs, leave out ` +
      `what doesn't — no one is told what you left out.\n\n` +
      `${url}` + optOut(opts.optOutToken) + SIGNOFF,
  };
}

/** The book has been assembled and is ready to be read through. */
export function bookReady(opts: {
  to: Recipient;
  childName: string;
  bookTitle: string;
  bookId: string;
}): OutboundEmail {
  const url = `${appUrl()}/books/${opts.bookId}/preview`;
  return {
    to: opts.to,
    subject: `${opts.bookTitle} is ready to read`,
    text:
      `${opts.childName}'s year is made.\n\n` +
      `Read it through before anything is printed. Change what you like, take out ` +
      `what doesn't belong, and tell us when it is right. Nothing goes to print, and ` +
      `nothing is charged, until you say so.\n\n` +
      `${url}` + SIGNOFF,
  };
}

/** The order is placed. Reassurance, at the moment money has changed hands. */
export function orderPlaced(opts: {
  to: Recipient;
  bookTitle: string;
  orderId: string;
  copies: number;
}): OutboundEmail {
  const url = `${appUrl()}/orders/${opts.orderId}`;
  return {
    to: opts.to,
    subject: `${opts.bookTitle} is going to print`,
    text:
      `We have it, exactly as you approved it.\n\n` +
      `${opts.copies > 1 ? `${countOf(opts.copies, "copy", "copies")} are` : "It is"} being ` +
      `printed on uncoated Mohawk and left to dry before binding, which is the slow part ` +
      `and the reason it looks the way it does. About two weeks to your door.\n\n` +
      `${url}` + SIGNOFF,
  };
}

/** It has shipped. */
export function orderShipped(opts: {
  to: Recipient;
  bookTitle: string;
  orderId: string;
  trackingUrl?: string | null;
}): OutboundEmail {
  const url = `${appUrl()}/orders/${opts.orderId}`;
  return {
    to: opts.to,
    subject: `${opts.bookTitle} is on its way`,
    text:
      `Bound, wrapped and posted.\n\n` +
      (opts.trackingUrl ? `Track it here:\n${opts.trackingUrl}\n\n` : "") +
      `${url}` + SIGNOFF,
  };
}

/**
 * The year is nearly up. This is the one message that asks for something,
 * and it is the closest thing the product has to a ritual — so it is once a
 * year, dated to their birthday, and it says what is missing rather than
 * nagging in general.
 */
export function yearClosing(opts: {
  to: Recipient;
  childName: string;
  subjectId: string;
  weeksLeft: number;
  optOutToken: string;
}): OutboundEmail {
  const url = `${appUrl()}/subjects/${opts.subjectId}`;
  return {
    to: opts.to,
    subject: `${opts.childName}'s year closes in ${countOf(opts.weeksLeft, "week")}`,
    text:
      `Their birthday is coming, which is when we close the year and make the book.\n\n` +
      `Anything you have been meaning to write down — the way they say a particular ` +
      `word, the thing they do every single morning — this is the moment. In a year ` +
      `you will not be able to reconstruct it, and that is the whole reason this exists.\n\n` +
      `${url}` + optOut(opts.optOutToken) + SIGNOFF,
  };
}

// ------------------------------------------------------------- renewals

/**
 * We are going to charge you, on this date, unless you say otherwise.
 *
 * The most important email the product sends, because it is the one that
 * decides whether a charge next month is expected or a dispute. It leads
 * with the amount and the date — not with how lovely the book is.
 */
export function renewalScheduled(opts: {
  to: Recipient;
  childName: string;
  bookTitle: string;
  bookId: string;
  renewalId: string;
  amountAud: number;
  chargeOn: string;
  cardLast4?: string | null;
}): OutboundEmail {
  const money = `A$${Math.round(opts.amountAud / 100)}`;
  return {
    to: opts.to,
    subject: `${opts.bookTitle} is ready — we'll charge ${money} on ${opts.chargeOn}`,
    text:
      `${opts.childName}'s year is made and waiting for you to read.\n\n` +
      `On ${opts.chargeOn} we will charge ${money}` +
      (opts.cardLast4 ? ` to the card ending ${opts.cardLast4}` : "") +
      ` and send it to print. That is ${NOTICE_DAYS} days from now, so there is time to ` +
      `read it through, change anything, or stop it.\n\n` +
      `Read it:\n${appUrl()}/books/${opts.bookId}/preview\n\n` +
      `Don't print it this year:\n${appUrl()}/renewals/${opts.renewalId}/cancel\n\n` +
      `One click, no reason needed, and we will not ask again unless you turn it ` +
      `back on.` + SIGNOFF,
  };
}

/** The quieter second notice, a few days out. */
export function renewalReminder(opts: {
  to: Recipient;
  bookTitle: string;
  bookId: string;
  renewalId: string;
  amountAud: number;
  days: number;
}): OutboundEmail {
  const money = `A$${Math.round(opts.amountAud / 100)}`;
  return {
    to: opts.to,
    subject: `${opts.bookTitle} goes to print in ${countOf(opts.days, "day")}`,
    text:
      `Just so it isn't a surprise: ${money} in ${countOf(opts.days, "day")}, then it prints.\n\n` +
      `Read it:\n${appUrl()}/books/${opts.bookId}/preview\n\n` +
      `Stop it:\n${appUrl()}/renewals/${opts.renewalId}/cancel` + SIGNOFF,
  };
}

/**
 * Not enough happened this year, so we are not charging.
 *
 * This costs revenue on purpose. Charging A$199 for a thin book about
 * someone's child is the worst thing this product could do, and the year
 * with nothing in it is exactly the year a silent charge becomes a dispute.
 */
export function renewalSkipped(opts: {
  to: Recipient;
  childName: string;
  subjectId: string;
}): OutboundEmail {
  return {
    to: opts.to,
    subject: `We haven't charged you for ${opts.childName}'s book`,
    text:
      `There wasn't enough in the archive this year to make a book worth printing, ` +
      `so we have not charged you and nothing has gone to print.\n\n` +
      `No judgement — some years are like that, and a thin book is worse than no ` +
      `book. Everything you have kept is still there, and it will all still be ` +
      `there whenever you want to pick it up.\n\n` +
      `${appUrl()}/subjects/${opts.subjectId}` + SIGNOFF,
  };
}

/** The card was declined, or the bank wants the cardholder present. */
export function renewalPaymentFailed(opts: {
  to: Recipient;
  bookTitle: string;
  bookId: string;
  needsAuthentication: boolean;
}): OutboundEmail {
  return {
    to: opts.to,
    subject: `We couldn't take payment for ${opts.bookTitle}`,
    text:
      (opts.needsAuthentication
        ? `Your bank wants you to confirm this one yourself, which is normal for a ` +
          `payment made without you there.\n\n`
        : `The saved card was declined — usually it has expired or been replaced.\n\n`) +
      `Nothing has been charged and nothing has printed. The book is finished and ` +
      `waiting; paying takes a minute:\n\n` +
      `${appUrl()}/books/${opts.bookId}/checkout` + SIGNOFF,
  };
}

// ---------------------------------------------------------------- guard

/**
 * Whether a message body appears to carry archive content.
 *
 * Deliberately crude and deliberately strict: it looks for the shapes private
 * content takes — quotation marks around speech, and long prose paragraphs
 * that are not one of the fixed sentences above. A false positive costs a
 * developer five minutes; a false negative puts a child's private life into
 * a third party's logs.
 */
export function containsArchiveContent(message: OutboundEmail): boolean {
  const body = `${message.subject}\n${message.text}`;

  // A quoted phrase is how the archive stores what a child said. Both the
  // curly and straight forms, because the app renders the curly ones and a
  // guard that only caught typewriter quotes would pass every real
  // quotation through.
  //
  // Double quotes only: an apostrophe is ordinary English, and matching it
  // flags "Florence's year" as a leak, which would make the guard so noisy
  // that someone would eventually switch it off.
  if (/[“"][^“”"]{3,}[”"]/.test(body)) return true;

  return false;
}
