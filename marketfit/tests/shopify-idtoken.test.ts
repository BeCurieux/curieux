/**
 * The ID token check, one rejection at a time.
 *
 * Shopify's docs list the checks a custom backend must make; each has a test
 * that fails it alone, so a check that quietly stopped running shows up as a
 * token that verifies when it should not.
 */

import { describe, expect, it } from "vitest";
import { bearerToken, signIdToken, verifyIdToken, type IdTokenClaims } from "@/shopify/idToken.js";

const SECRET = "shpss_test_secret";
const CLIENT_ID = "client-id-123";
const NOW = 1_800_000_000_000;

function claims(overrides: Partial<IdTokenClaims> = {}): IdTokenClaims {
  const now = Math.floor(NOW / 1000);
  return {
    iss: "https://aurelia-skin.myshopify.com/admin",
    dest: "https://aurelia-skin.myshopify.com",
    aud: CLIENT_ID,
    sub: "42",
    exp: now + 60,
    nbf: now - 1,
    iat: now - 1,
    jti: "f8912129-1af6-4cad-9ca3-76b0f7621087",
    sid: "aaea182f",
    ...overrides,
  };
}

function verify(token: string | null, secrets: string | string[] = SECRET) {
  return verifyIdToken({ token, clientId: CLIENT_ID, secrets, now: () => NOW });
}

describe("verifyIdToken", () => {
  it("accepts a token signed with the client secret and returns the shop from dest", () => {
    const result = verify(signIdToken(claims(), SECRET));
    expect(result).toMatchObject({ ok: true, shop: "aurelia-skin.myshopify.com" });
  });

  it("accepts the previous secret during a rotation", () => {
    expect(verify(signIdToken(claims(), "old"), ["new", "old"]).ok).toBe(true);
  });

  it.each([
    ["no token", null, "malformed"],
    ["two segments", "a.b", "malformed"],
    ["garbage", "!!.??.**", "malformed"],
  ] as const)("rejects %s", (_, token, reason) => {
    expect(verify(token)).toEqual({ ok: false, reason });
  });

  it("rejects a token signed with another secret", () => {
    expect(verify(signIdToken(claims(), "somebody-else"))).toEqual({ ok: false, reason: "signature" });
  });

  it("rejects alg none and anything that is not HS256, before comparing signatures", () => {
    expect(verify(signIdToken(claims(), SECRET, "none"))).toEqual({ ok: false, reason: "algorithm" });
    expect(verify(signIdToken(claims(), SECRET, "RS256"))).toEqual({ ok: false, reason: "algorithm" });
  });

  it("rejects a tampered payload", () => {
    const [h, , s] = signIdToken(claims(), SECRET).split(".");
    const forged = Buffer.from(JSON.stringify(claims({ dest: "https://other.myshopify.com" }))).toString("base64url");
    expect(verify(`${h}.${forged}.${s}`)).toEqual({ ok: false, reason: "signature" });
  });

  it("rejects an expired token, allowing a few seconds of skew", () => {
    const now = Math.floor(NOW / 1000);
    expect(verify(signIdToken(claims({ exp: now - 1 }), SECRET)).ok).toBe(true);
    expect(verify(signIdToken(claims({ exp: now - 10 }), SECRET))).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects a token that is not valid yet", () => {
    const now = Math.floor(NOW / 1000);
    expect(verify(signIdToken(claims({ nbf: now + 30 }), SECRET))).toEqual({ ok: false, reason: "not-yet-valid" });
  });

  it("rejects a token issued for another app", () => {
    expect(verify(signIdToken(claims({ aud: "another-app" }), SECRET))).toEqual({ ok: false, reason: "audience" });
  });

  it("rejects iss and dest naming different hosts", () => {
    const token = signIdToken(claims({ iss: "https://evil.myshopify.com/admin" }), SECRET);
    expect(verify(token)).toEqual({ ok: false, reason: "issuer-mismatch" });
  });

  it("rejects a dest that is not a myshopify domain", () => {
    const token = signIdToken(
      claims({ iss: "https://shop.example.com/admin", dest: "https://shop.example.com" }),
      SECRET,
    );
    expect(verify(token)).toEqual({ ok: false, reason: "not-a-shop" });
  });
});

describe("bearerToken", () => {
  it("reads the token off an Authorization header and nothing else", () => {
    expect(bearerToken("Bearer abc.def.ghi")).toBe("abc.def.ghi");
    expect(bearerToken("bearer   abc")).toBe("abc");
    expect(bearerToken("Basic abc")).toBeNull();
    expect(bearerToken(undefined)).toBeNull();
  });
});
