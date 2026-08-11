// What arrives, and whether it needs anything from anyone.
//
// The Memory Inbox exists because capture that takes more than a few seconds
// is capture that stops happening. Which means the inbox has one job that
// matters more than any feature in it: **it has to usually be empty.**
//
// A parent who shares twenty photographs from a birthday and finds twenty
// items waiting to be filed has not been given an inbox, they have been
// given twenty chores and a reason to stop sharing. So nothing arrives in a
// pile-to-process. Everything that arrives is *kept immediately* — counted,
// searchable, exported, deletable, part of the graph — and the inbox holds
// only the residue: the small number of things the archive genuinely cannot
// work out on its own.
//
// The second rule follows from the first: **never ask a question the archive
// can answer itself.** A photograph carrying a capture date does not need a
// date question. A quote typed into the app thirty seconds ago does not need
// one either. Asking anyway is how a product teaches people that using it
// costs more than not using it.

/** How something got here. Null means the ordinary way: through the app. */
export type ArrivedVia = "share" | "email" | "quick";

export interface Arrival {
  /** photo, video, quote, voice, text — as the memory will be typed. */
  type: string;
  /** From the file's own metadata, when it survived the journey. */
  captureTimestamp?: string | null;
  /** When this reached us. Always known. */
  arrivedAt: string;
  via: ArrivedVia;
}

export interface Filed {
  /** The date to record, or null when guessing would corrupt the archive. */
  memoryDate: string | null;
  /**
   * The one open question, or null when there is nothing to ask.
   *
   * Null is the overwhelmingly common answer and is meant to be.
   */
  question: string | null;
}

const iso = (t: string) => t.slice(0, 10);

/**
 * Kinds of thing whose arrival time is their time.
 *
 * You typed the quote just now; the day it arrived is the day it happened,
 * and asking would be asking somebody to confirm something they had just
 * done. A photograph is the opposite: it can be six years old and look
 * exactly like today's.
 */
const DATED_BY_ARRIVAL = new Set(["quote", "text", "voice", "milestone"]);

/**
 * Where a new arrival lands.
 *
 * The one thing this refuses to do is guess a date for an undated
 * photograph. Stamping today onto a picture from 2019 because it happened to
 * be shared today is not a small inaccuracy — it moves a memory to the wrong
 * year, into the wrong book, and the archive has no way to notice it later.
 * A null date is honest and recoverable; a confident wrong one is neither.
 */
export function fileArrival(arrival: Arrival): Filed {
  if (arrival.captureTimestamp) {
    return { memoryDate: iso(arrival.captureTimestamp), question: null };
  }

  if (DATED_BY_ARRIVAL.has(arrival.type)) {
    return { memoryDate: iso(arrival.arrivedAt), question: null };
  }

  return {
    memoryDate: null,
    // Phrased as a thing they can ignore, because they can. An unanswered
    // question costs the memory its place in the year's ordering and nothing
    // else — it is still kept, still exported, still theirs.
    question: "Roughly when was this?",
  };
}

/** Whether an arrival will sit in the inbox rather than filing itself. */
export function needsFiling(arrival: Arrival): boolean {
  return fileArrival(arrival).question !== null;
}

// -------------------------------------------------------------- the sender

/**
 * What to do with something emailed in.
 *
 * An inbox address is a bearer credential: anyone who learns it can write
 * into a family's archive. The privacy brief's rule was to invite people
 * individually rather than generate links anyone can use, and an address
 * that accepts anything from anyone is that link with extra steps.
 *
 * So the default is that only people already in the family land straight in.
 * Anything else is not refused outright — a grandparent mailing from a work
 * address is a real thing that happens, and silently dropping it is worse
 * than asking — but it goes to the review queue the product already has,
 * where a parent decides. That reuses a screen, a rule and a mental model
 * that all already exist.
 */
export type SenderVerdict = "accept" | "review" | "refuse";

export interface SenderRules {
  /** Email addresses of people in this family, lower-cased. */
  familyAddresses: string[];
  /** Whether the family has opted into accepting mail from outside it. */
  acceptFromAnyone: boolean;
}

export function verdictForSender(from: string, rules: SenderRules): SenderVerdict {
  const sender = normaliseAddress(from);
  if (!sender) return "refuse";
  if (rules.familyAddresses.some((a) => normaliseAddress(a) === sender)) return "accept";
  return rules.acceptFromAnyone ? "review" : "refuse";
}

/**
 * The address out of a From header.
 *
 * Headers arrive as `Grandma <gran@example.com>`, as a bare address, and
 * occasionally with the display name containing an @ of its own — so the
 * angle brackets win when they are there rather than the first @ found.
 */
export function normaliseAddress(from: string): string {
  const angled = from.match(/<([^>]+)>/);
  const raw = (angled ? angled[1] : from).trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw) ? raw : "";
}
