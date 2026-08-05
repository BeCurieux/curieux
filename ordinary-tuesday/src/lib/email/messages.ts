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
