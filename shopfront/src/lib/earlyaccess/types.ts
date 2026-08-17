/**
 * What somebody sends when they ask for a shop.
 *
 * **This is the Sprint 3 email-capture gate, opened on the owner's explicit
 * call (2026-08-17).** `CLAUDE.md` records the override and
 * `tests/stop-line.test.tsx` was narrowed in the same commit rather than
 * routed around. What opened is popuup's own contact form. What stays shut is
 * capture *inside a generated shop* — the `capture` block still renders
 * nothing, is still absent from what the merchandiser may choose, and a
 * merchant collecting their shoppers' addresses is still Sprint 3.
 *
 * The distinction is not a technicality. A merchant typing their own address
 * into our contact form knows exactly who they are writing to. A shopper
 * handing an address to a shop is a different person consenting to a different
 * thing, with a different legal footing, and it needs the machinery — double
 * opt-in, unsubscribe, a lawful basis recorded — that none of this builds.
 *
 * Four fields, all of them things a person can answer without looking anything
 * up. `store` is the one that does work: it is what makes a reply possible at
 * all, because the whole motion is that a shop can be built from a public
 * `/products.json` before anybody has agreed to anything.
 */

import { z } from "zod";

/**
 * Deliberately permissive, and the reasoning matters.
 *
 * An email regex that tries to be correct is wrong — the grammar allows quoted
 * local parts, comments and addresses with no dot in the domain, and every
 * "strict" pattern in circulation rejects somebody's real address. The only
 * check that proves an address works is sending to it. So this asks for the
 * shape that catches a typo (`something@something.something`, no spaces) and
 * refuses to adjudicate anything past that.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Caps, so that a form post cannot be a payload.
 *
 * `brief` is the long one because it is the field that decides whether we can
 * actually help — "people arriving from our Ibiza reel, swim first, linen next,
 * under £180" is the difference between a reply and a guess — and 2000
 * characters is roughly a screen and a half of typing.
 */
export const LIMITS = {
  name: 120,
  email: 200,
  store: 300,
  brief: 2000,
} as const;

export const EarlyAccessRequest = z.object({
  name: z.string().trim().min(1, "Tell us what to call you.").max(LIMITS.name),
  email: z.string().trim().max(LIMITS.email).regex(EMAIL, "That does not look like an email address."),
  /**
   * A store, however they happen to write it. `nectarandbone.com`,
   * `https://nectarandbone.com/`, `www.nectarandbone.com` are the same answer
   * and a form that rejected two of the three would be a form that blamed the
   * person for its own pedantry. Normalised on the way in, not validated into
   * submission.
   */
  store: z.string().trim().min(3, "Which store?").max(LIMITS.store),
  brief: z.string().trim().max(LIMITS.brief).optional(),
});

export type EarlyAccessRequest = z.infer<typeof EarlyAccessRequest>;

export interface EarlyAccessRecord extends EarlyAccessRequest {
  id: string;
  /** Server-stamped. A client may say what it wants; it may not say when. */
  receivedAt: string;
}

/**
 * `nectarandbone.com` from whatever they typed.
 *
 * Lowercased, scheme and `www.` and trailing slash removed, path kept — a
 * merchant who pastes a collection URL has still told us their store, and
 * throwing the path away would lose the more interesting half of what they
 * said. Anything that does not parse as a URL is kept verbatim: this is a note
 * for a human to read, not a key to look anything up by.
 */
export function normaliseStore(input: string): string {
  const trimmed = input.trim();
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(withScheme);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const path = url.pathname.replace(/\/+$/, "");
    return host + path;
  } catch {
    return trimmed;
  }
}
