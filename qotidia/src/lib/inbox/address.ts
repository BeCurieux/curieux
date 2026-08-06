// A private address that things can be sent to.
//
// This is the door that does not require opening the app: forward a photo
// from a partner, mail a note from a work laptop, send in the thing a
// grandparent took on Sunday. It is also, unavoidably, a **bearer
// credential** — anybody who knows the address can write into a family's
// archive — and it is the only credential in this product that gets printed
// on a screen and then typed into other people's phones.
//
// Three consequences shape everything here.
//
// The token is long and random rather than derived from anything. A subject
// id, a family name or a birthday would make the address guessable by
// somebody who already knows the family, which is exactly the wrong threat
// model for a childhood archive.
//
// The local part carries the child's name only as a hint, and the hint is
// never what is checked. It exists so a parent can tell two addresses apart
// in their contacts, and it can be wrong without consequence.
//
// And the address is replaceable. Anything given out will eventually end up
// somewhere it should not be — a forwarded thread, a shared screenshot — and
// a credential you cannot change is one you have to hope about.

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Bytes of randomness in an address token.
 *
 * 24 bytes is 192 bits, which is far past what anybody could guess and still
 * short enough to read out over a phone if it comes to that. Erring long is
 * cheap here: nobody types this address twice, they save it.
 */
export const TOKEN_BYTES = 24;

/** Where inbound mail is received. Configured, because it is a real domain. */
export const inboxDomain = () => process.env.INBOX_DOMAIN ?? "in.qotidia.com";

export function newToken(): string {
  // base32-ish alphabet: no vowels, so it cannot spell anything, and no
  // characters that survive a handwritten note ambiguously.
  const alphabet = "23456789bcdfghjkmnpqrstvwxz";
  const bytes = randomBytes(TOKEN_BYTES);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

/**
 * The hint before the token.
 *
 * Purely cosmetic, and treated as such everywhere: `florence.k3m…` is easier
 * to find in a contacts list than a wall of random characters. A child called
 * "Zoë 李" produces an empty hint and an address that still works.
 */
export function hintFor(displayName: string | null | undefined): string {
  const first = (displayName ?? "").split(/\s+/)[0] ?? "";
  const cleaned = first
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
  return cleaned.slice(0, 16);
}

/** The address as a family sees it. */
export function addressFor(token: string, displayName?: string | null): string {
  const hint = hintFor(displayName);
  return `${hint ? `${hint}.` : ""}${token}@${inboxDomain()}`;
}

/**
 * The token out of an address something was sent to.
 *
 * Deliberately forgiving about the hint and strict about nothing else: mail
 * systems lower-case, rewrite and sub-address, so `Florence.abc+notes@…`
 * has to resolve to the same token as `florence.abc@…`. The token is
 * whatever sits between the last dot and the plus-or-at.
 */
export function tokenFrom(address: string): string | null {
  const local = address.trim().toLowerCase().split("@")[0] ?? "";
  const withoutTag = local.split("+")[0] ?? "";
  const token = withoutTag.includes(".") ? withoutTag.slice(withoutTag.lastIndexOf(".") + 1) : withoutTag;
  return /^[a-z0-9]{8,}$/.test(token) ? token : null;
}

/**
 * Whether a presented token is the stored one.
 *
 * Constant time, because this is a secret being compared against attacker-
 * supplied input and a short-circuiting `===` leaks how much of a guess was
 * right. Hashed to a fixed length first so that comparing a 4-character
 * guess against a 39-character token does not throw on a length mismatch,
 * and so the comparison itself reveals nothing about the length either.
 */
export function tokenMatches(presented: string, stored: string): boolean {
  const digest = (s: string) => createHash("sha256").update(s, "utf8").digest();
  return timingSafeEqual(digest(presented), digest(stored));
}
