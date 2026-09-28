/**
 * The ID token an embedded app receives from App Bridge, checked by hand.
 *
 * Shopify's templates validate this for you; Franca is not built on a template,
 * so it does what the docs say a custom backend must do
 * (https://shopify.dev/docs/apps/build/authentication-authorization/id-tokens):
 *
 *   > check the token's signature against your client secret using HS256
 *   > (HMAC-SHA256), then check the following claims. If any check fails,
 *   > reject the request with a 401 before calling the token endpoint.
 *
 *   exp  must be in the future        nbf  must be in the past
 *   aud  must match the client ID     iss and dest  hostnames must match
 *
 * The token is the only thing that says which shop a request from inside the
 * admin is about, and everything downstream — which products to read, which
 * scores to show, which badge to serve — keys on that answer. So the shop is
 * read from `dest`, validated as a myshopify domain, and returned only when
 * every check above has passed. There is no partial result.
 *
 * What the tests below it cannot prove is that a token Shopify actually issued
 * verifies — only a live app does that. They prove the algorithm and each
 * rejection, which is the part that goes wrong.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { ShopDomain } from "./webhook.js";

export type IdTokenClaims = {
  iss: string;
  dest: string;
  aud: string;
  exp: number;
  nbf: number;
  iat?: number;
  jti?: string;
  /** The staff member the token was issued for. Read, never validated. */
  sub?: string;
  sid?: string;
};

export type IdTokenFailure =
  | "malformed"
  | "algorithm"
  | "signature"
  | "expired"
  | "not-yet-valid"
  | "audience"
  | "issuer-mismatch"
  | "not-a-shop";

export type IdTokenResult =
  | { ok: true; shop: string; claims: IdTokenClaims }
  | { ok: false; reason: IdTokenFailure };

export interface VerifyIdTokenOptions {
  token: string | null | undefined;
  /** The app's client ID (the API key). `aud` must equal it. */
  clientId: string;
  /**
   * The client secret, or two during a rotation. The same reasoning as the
   * webhook verifier: a rotation window where only the new secret is accepted
   * is an hour of every open admin session failing.
   */
  secrets: string | readonly string[];
  now?: () => number;
  /**
   * Seconds of clock skew tolerated on `exp` and `nbf`. Small, because the
   * token lives for a minute: a generous leeway is a replay window.
   */
  leewaySeconds?: number;
}

const DEFAULT_LEEWAY_SECONDS = 5;

/** Pulls the bearer token off an `Authorization` header, or null. */
export function bearerToken(header: string | null | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

export function verifyIdToken(options: VerifyIdTokenOptions): IdTokenResult {
  const parts = options.token?.split(".");
  if (!parts || parts.length !== 3 || parts.some((p) => p.length === 0)) return fail("malformed");
  const [headerPart, payloadPart, signaturePart] = parts as [string, string, string];

  const header = decodeJson(headerPart);
  if (!header) return fail("malformed");
  // Checked before the signature so that `alg: none`, or an RS256 token whose
  // "signature" we would otherwise HMAC, never gets as far as a comparison.
  if (header["alg"] !== "HS256") return fail("algorithm");

  const signed = `${headerPart}.${payloadPart}`;
  const presented = base64UrlToBuffer(signaturePart);
  if (!presented) return fail("malformed");
  const secrets = typeof options.secrets === "string" ? [options.secrets] : options.secrets;
  const matches = secrets.some((secret) => {
    if (!secret) return false;
    const expected = createHmac("sha256", secret).update(signed).digest();
    return expected.length === presented.length && timingSafeEqual(expected, presented);
  });
  if (!matches) return fail("signature");

  const claims = asClaims(decodeJson(payloadPart));
  if (!claims) return fail("malformed");

  const now = Math.floor((options.now?.() ?? Date.now()) / 1000);
  const leeway = options.leewaySeconds ?? DEFAULT_LEEWAY_SECONDS;
  if (claims.exp + leeway <= now) return fail("expired");
  if (claims.nbf - leeway > now) return fail("not-yet-valid");
  if (claims.aud !== options.clientId) return fail("audience");

  const issHost = hostnameOf(claims.iss);
  const destHost = hostnameOf(claims.dest);
  if (!issHost || !destHost || issHost !== destHost) return fail("issuer-mismatch");
  if (!ShopDomain.safeParse(destHost).success) return fail("not-a-shop");

  return { ok: true, shop: destHost, claims };
}

function fail(reason: IdTokenFailure): IdTokenResult {
  return { ok: false, reason };
}

function base64UrlToBuffer(part: string): Buffer | null {
  if (!/^[A-Za-z0-9_-]+$/.test(part)) return null;
  return Buffer.from(part, "base64url");
}

function decodeJson(part: string): Record<string, unknown> | null {
  const bytes = base64UrlToBuffer(part);
  if (!bytes) return null;
  try {
    const value: unknown = JSON.parse(bytes.toString("utf8"));
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function asClaims(value: Record<string, unknown> | null): IdTokenClaims | null {
  if (!value) return null;
  const { iss, dest, aud, exp, nbf } = value;
  if (typeof iss !== "string" || typeof dest !== "string" || typeof aud !== "string") return null;
  if (typeof exp !== "number" || typeof nbf !== "number") return null;
  const optional = (key: string) => (typeof value[key] === "string" ? (value[key] as string) : undefined);
  return {
    iss,
    dest,
    aud,
    exp,
    nbf,
    iat: typeof value["iat"] === "number" ? value["iat"] : undefined,
    jti: optional("jti"),
    sub: optional("sub"),
    sid: optional("sid"),
  };
}

function hostnameOf(value: string): string | null {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Test and fixture helper: signs claims the way Shopify documents it does. */
export function signIdToken(claims: IdTokenClaims, secret: string, alg = "HS256"): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const signed = `${encode({ alg, typ: "JWT" })}.${encode(claims)}`;
  const signature = createHmac("sha256", secret).update(signed).digest("base64url");
  return `${signed}.${signature}`;
}
