import { randomBytes } from "node:crypto";

/**
 * Tokens that are credentials.
 *
 * Distinct from `newId()` in lib/db/store.ts, which is `Math.random()` plus a
 * timestamp. That is right for a widget id — short, readable, and it does not
 * matter if you can guess the next one, because knowing an id gets you nothing
 * without owning the row.
 *
 * A session token and a password-reset token are the opposite: holding one
 * *is* the authorisation. `Math.random()` is a PRNG whose internal state can be
 * recovered from its own output, so a stream of guessable session tokens is a
 * stream of accounts. These come from the CSPRNG instead.
 *
 * 32 bytes, base64url so it survives being a URL path segment and a cookie
 * value without escaping.
 */
export function newSecureToken(prefix = ""): string {
  return prefix + randomBytes(32).toString("base64url");
}

/** How long a password-reset link is good for. */
export const RESET_TOKEN_TTL_MINUTES = 60;

export function resetExpiry(from: Date = new Date()): string {
  return new Date(from.getTime() + RESET_TOKEN_TTL_MINUTES * 60_000).toISOString();
}
