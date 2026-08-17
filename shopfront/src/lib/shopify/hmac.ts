/**
 * Webhook signature verification.
 *
 * The one piece of the Shopify app that is pure arithmetic, and therefore the
 * one piece that can be built correctly without ever reaching Shopify. Nothing
 * here needs a network, a token or an app.
 *
 * Verified against shopify.dev (see SHOPIFY-APP.md §5.2 for the citations):
 *
 *   > Each HTTPS delivery includes a base64-encoded HMAC signature in the
 *   > X-Shopify-Hmac-SHA256 header, generated using your app's client secret
 *   > and the raw request body.
 *
 * What these tests cannot prove is that our digest matches one Shopify actually
 * produced — only a live delivery does that, and this environment has no route
 * to Shopify. What they do prove is the algorithm, the tamper rejection and the
 * two failure modes below, which is the part that is normally got wrong.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The raw bytes as received.
 *
 * A string is accepted for convenience and encoded as UTF-8, but the caller
 * should hand over what came off the wire. Every framework that parses JSON
 * and re-serialises it changes the bytes, and a re-serialised body fails
 * verification 100% of the time for reasons that look like a key problem.
 */
export type RawBody = string | Uint8Array;

export interface VerifyOptions {
  body: RawBody;
  /** The value of the `X-Shopify-Hmac-SHA256` header, base64. */
  signature: string | null | undefined;
  /**
   * The app's client secret, or several.
   *
   * Several, because of a documented rotation window: "If you rotate your app's
   * client secret, it can take up to an hour for the HMAC digest to be
   * generated using the new secret." An app that swapped one string for another
   * would reject an hour of real deliveries, and those deliveries are not
   * retried forever.
   */
  secret: string | readonly string[];
}

/** Base64 HMAC-SHA256 of a body under one secret. Exported for tests. */
export function signBody(body: RawBody, secret: string): string {
  return createHmac("sha256", secret)
    .update(typeof body === "string" ? Buffer.from(body, "utf8") : body)
    .digest("base64");
}

/**
 * Is this delivery from Shopify?
 *
 * Returns a boolean and never throws. A malformed signature is a rejection, not
 * an exception — the route above this has to answer 401 to a bad HMAC, and a
 * thrown error there becomes a 500, which is both the wrong answer and one that
 * fails app review.
 */
export function verifyWebhookSignature({ body, signature, secret }: VerifyOptions): boolean {
  if (!signature) return false;

  const secrets = (typeof secret === "string" ? [secret] : secret).filter((s) => s.length > 0);
  // An empty secret list must never pass. Reached when configuration is
  // missing, which is exactly when a permissive default would be worst: an
  // unconfigured deployment would accept every unsigned request on the planet.
  if (secrets.length === 0) return false;

  const provided = Buffer.from(signature, "utf8");

  let matched = false;
  for (const candidate of secrets) {
    const computed = Buffer.from(signBody(body, candidate), "utf8");
    // Length first. Node's timingSafeEqual throws on differing lengths, so
    // without this a truncated or padded header is a 500 rather than a clean
    // rejection — Shopify's own sample calls this check out for the same
    // reason.
    if (computed.length !== provided.length) continue;
    // No early exit: every candidate is compared even once one has matched, so
    // the time this takes does not report how many secrets were tried or which
    // one was right.
    if (timingSafeEqual(computed, provided)) matched = true;
  }

  return matched;
}
