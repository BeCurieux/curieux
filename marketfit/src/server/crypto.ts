/**
 * Shopify tokens, sealed before they reach the database.
 *
 * AES-256-GCM with a key that lives only in the app's environment
 * (`MARKETFIT_TOKEN_KEY`), so a database dump, a leaked backup or a stray SQL
 * query yields ciphertext and nothing that opens a merchant's store. The shop
 * domain is bound in as associated data: a sealed token copied onto another
 * shop's row fails to open rather than quietly working for the wrong store.
 *
 * Rotation: set the new key as `MARKETFIT_TOKEN_KEY` and the old one as
 * `MARKETFIT_TOKEN_KEY_PREVIOUS`. Tokens open under either and are resealed under
 * the new one the next time they are written, which for an access token is
 * within the hour.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;

export type TokenKeys = { current: Buffer; previous?: Buffer };

/** A 32-byte key from base64, or an error that says what is wrong with it. */
export function parseTokenKey(value: string, name = "MARKETFIT_TOKEN_KEY"): Buffer {
  const key = Buffer.from(value, "base64");
  if (key.length !== 32) {
    throw new Error(`${name} must be 32 bytes, base64-encoded (openssl rand -base64 32); got ${key.length} bytes.`);
  }
  return key;
}

export function sealToken(plain: string, shop: string, keys: TokenKeys): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", keys.current, iv);
  cipher.setAAD(Buffer.from(shop, "utf8"));
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `${VERSION}.${Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url")}`;
}

export function openToken(sealed: string, shop: string, keys: TokenKeys): string {
  const [version, payload] = sealed.split(".");
  if (version !== VERSION || !payload) throw new Error("Not a sealed token.");
  const bytes = Buffer.from(payload, "base64url");
  if (bytes.length < IV_BYTES + TAG_BYTES) throw new Error("Sealed token is truncated.");
  const iv = bytes.subarray(0, IV_BYTES);
  const tag = bytes.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const body = bytes.subarray(IV_BYTES + TAG_BYTES);

  for (const key of [keys.current, keys.previous]) {
    if (!key) continue;
    try {
      const decipher = createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAAD(Buffer.from(shop, "utf8"));
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
    } catch {
      // Wrong key, wrong shop or tampered: try the next key, then give up.
    }
  }
  throw new Error("Sealed token does not open under any configured key for this shop.");
}
