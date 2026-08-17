/**
 * Webhook signature verification.
 *
 * These prove the algorithm and the failure modes. They cannot prove our digest
 * matches one Shopify actually produced — that needs a live delivery and this
 * environment has no route to Shopify. The independent computation below is an
 * independent *implementation*, not an independent *source*.
 */

import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { signBody, verifyWebhookSignature } from "@/lib/shopify/hmac";

const SECRET = "hush-this-is-the-client-secret";
const BODY = JSON.stringify({ id: 788032119674292922, handle: "kelp-crew", title: "Kelp Crew" });

/** Computed straight from node:crypto, not through the module under test. */
function independently(body: string, secret: string): string {
  return createHmac("sha256", secret).update(Buffer.from(body, "utf8")).digest("base64");
}

describe("verifyWebhookSignature", () => {
  it("accepts a signature computed the documented way", () => {
    // base64(HMAC-SHA256(raw body, client secret)) — shopify.dev, verify-deliveries.
    const signature = independently(BODY, SECRET);
    expect(signBody(BODY, SECRET)).toBe(signature);
    expect(verifyWebhookSignature({ body: BODY, signature, secret: SECRET })).toBe(true);
  });

  it("rejects a body altered by one character", () => {
    // The whole point. A delivery whose body was tampered with in flight must
    // not be processed, and price is the field an attacker would want.
    const signature = independently(BODY, SECRET);
    const tampered = BODY.replace("Kelp Crew", "Kelp Crow");
    expect(tampered).not.toBe(BODY);
    expect(verifyWebhookSignature({ body: tampered, signature, secret: SECRET })).toBe(false);
  });

  it("rejects a signature made with a different secret", () => {
    const signature = independently(BODY, "somebody-else's-secret");
    expect(verifyWebhookSignature({ body: BODY, signature, secret: SECRET })).toBe(false);
  });

  it("rejects a truncated signature without throwing", () => {
    // Node's timingSafeEqual throws on buffers of differing lengths. Without
    // the length check first, a malformed header is a 500 rather than the 401
    // app review requires.
    const signature = independently(BODY, SECRET).slice(0, 20);
    expect(() => verifyWebhookSignature({ body: BODY, signature, secret: SECRET })).not.toThrow();
    expect(verifyWebhookSignature({ body: BODY, signature, secret: SECRET })).toBe(false);
  });

  it("rejects a padded signature without throwing", () => {
    const signature = `${independently(BODY, SECRET)}AAAA`;
    expect(verifyWebhookSignature({ body: BODY, signature, secret: SECRET })).toBe(false);
  });

  it("rejects a missing header", () => {
    expect(verifyWebhookSignature({ body: BODY, signature: null, secret: SECRET })).toBe(false);
    expect(verifyWebhookSignature({ body: BODY, signature: undefined, secret: SECRET })).toBe(false);
    expect(verifyWebhookSignature({ body: BODY, signature: "", secret: SECRET })).toBe(false);
  });

  it("accepts either secret during a rotation window", () => {
    // "If you rotate your app's client secret, it can take up to an hour for
    // the HMAC digest to be generated using the new secret." An app that swapped
    // one string for the other would reject an hour of real deliveries.
    const oldSecret = "the-old-one";
    const newSecret = "the-new-one";
    const secrets = [newSecret, oldSecret];

    expect(
      verifyWebhookSignature({ body: BODY, signature: independently(BODY, oldSecret), secret: secrets }),
    ).toBe(true);
    expect(
      verifyWebhookSignature({ body: BODY, signature: independently(BODY, newSecret), secret: secrets }),
    ).toBe(true);
    expect(
      verifyWebhookSignature({ body: BODY, signature: independently(BODY, "neither"), secret: secrets }),
    ).toBe(false);
  });

  it("never passes when no secret is configured", () => {
    // The dangerous default. An unconfigured deployment must reject everything,
    // not accept everything — this is reached exactly when someone forgot to set
    // an environment variable.
    expect(verifyWebhookSignature({ body: BODY, signature: "anything", secret: [] })).toBe(false);
    expect(verifyWebhookSignature({ body: BODY, signature: "anything", secret: "" })).toBe(false);
    expect(verifyWebhookSignature({ body: BODY, signature: "anything", secret: [""] })).toBe(false);
  });

  it("signs raw bytes identically to the equivalent string", () => {
    // The route must hand over what came off the wire. A body that has been
    // parsed and re-serialised is different bytes and fails every time, so both
    // input forms have to mean the same thing when the bytes are the same.
    const bytes = new TextEncoder().encode(BODY);
    expect(signBody(bytes, SECRET)).toBe(signBody(BODY, SECRET));
  });

  it("distinguishes bodies that differ only in whitespace", () => {
    // Which is why re-serialising breaks it: JSON.stringify of a parsed body is
    // semantically identical and byte-wise different.
    const respaced = JSON.stringify(JSON.parse(BODY), null, 2);
    const signature = independently(BODY, SECRET);
    expect(verifyWebhookSignature({ body: respaced, signature, secret: SECRET })).toBe(false);
  });

  it("handles a body with multi-byte characters", () => {
    const body = JSON.stringify({ title: "Crème brûlée candle — 白" });
    const signature = independently(body, SECRET);
    expect(verifyWebhookSignature({ body, signature, secret: SECRET })).toBe(true);
  });
});
