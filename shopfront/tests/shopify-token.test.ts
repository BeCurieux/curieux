/**
 * The expiring-token lifecycle, driven by a fake clock.
 *
 * Everything here is about behaviour over time, so the clock is an argument.
 * The lifetimes used are the ones shopify.dev's example shows — 3600 and
 * 7776000 — but note that no test asserts the *code* knows those numbers: it
 * reads them off the response, because the documented values are an example and
 * this environment has never seen a real exchange.
 */

import { describe, expect, it, vi } from "vitest";
import {
  accessTokenUsable,
  ensureAccessToken,
  readTokenResponse,
  refreshable,
  REFRESH_SKEW_MS,
  tokenState,
  type TokenResponse,
} from "@/lib/shopify/token";

const T0 = new Date("2026-08-17T09:00:00Z");
const at = (ms: number) => new Date(T0.getTime() + ms);
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** The documented response shape, quoted from shopify.dev. */
const EXPIRING: TokenResponse = {
  access_token: "shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  expires_in: 3600,
  refresh_token: "shprt_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  refresh_token_expires_in: 7776000,
  scope: "read_products",
};

describe("readTokenResponse", () => {
  it("dates a relative expiry against the moment it was received", () => {
    const token = readTokenResponse(EXPIRING, T0);
    expect(token.accessExpiresAt).toEqual(at(HOUR));
    expect(token.refreshExpiresAt).toEqual(at(90 * DAY));
    expect(token.refreshToken).toBe("shprt_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
  });

  it("treats a response with no expires_in as non-expiring", () => {
    // The legacy shape, and the safe reading of an absent field. Guessing a
    // lifetime would make a perfectly good token expire on a schedule we
    // invented.
    const token = readTokenResponse({ access_token: "shpat_legacy" }, T0);
    expect(token.accessExpiresAt).toBeNull();
    expect(token.refreshToken).toBeNull();
    expect(accessTokenUsable(token, at(10 * 365 * DAY))).toBe(true);
  });

  it("splits the comma-separated scope string Shopify returns", () => {
    const token = readTokenResponse({ ...EXPIRING, scope: "write_products,read_orders" }, T0);
    // Recorded as granted, which is not necessarily as requested — the whole
    // reason app/scopes_update exists.
    expect(token.scopes).toEqual(["write_products", "read_orders"]);
  });

  it("records no scopes rather than an empty string when none came back", () => {
    expect(readTokenResponse({ access_token: "shpat_x" }, T0).scopes).toEqual([]);
  });
});

describe("accessTokenUsable", () => {
  const token = readTokenResponse(EXPIRING, T0);

  it("is usable well before expiry", () => {
    expect(accessTokenUsable(token, at(30 * MINUTE))).toBe(true);
  });

  it("stops being usable a skew window early", () => {
    // Refreshing reactively — call, take a 401, refresh, retry — spends a
    // failed request every cycle and turns clock skew into an outage.
    expect(accessTokenUsable(token, at(HOUR - REFRESH_SKEW_MS - 1000))).toBe(true);
    expect(accessTokenUsable(token, at(HOUR - REFRESH_SKEW_MS))).toBe(false);
    expect(accessTokenUsable(token, at(HOUR))).toBe(false);
  });
});

describe("tokenState", () => {
  it("is ready while the access token is good", () => {
    const token = readTokenResponse(EXPIRING, T0);
    expect(tokenState(token, at(MINUTE)).state).toBe("ready");
  });

  it("asks for a refresh once inside the skew window", () => {
    const token = readTokenResponse(EXPIRING, T0);
    expect(tokenState(token, at(HOUR - MINUTE)).state).toBe("refresh");
  });

  it("needs reauth when the refresh token has itself expired", () => {
    // Ninety days of merchant inactivity. The docs are explicit that
    // re-acquiring needs merchant interaction, so this is not something the app
    // can resolve on its own.
    const token = readTokenResponse(EXPIRING, T0);
    expect(refreshable(token, at(89 * DAY))).toBe(true);
    expect(refreshable(token, at(91 * DAY))).toBe(false);

    const state = tokenState(token, at(91 * DAY));
    expect(state.state).toBe("needs-reauth");
    if (state.state === "needs-reauth") expect(state.reason).toBe("refresh-token-expired");
  });

  it("needs reauth when an expiring token came back with no refresh token", () => {
    const token = readTokenResponse({ access_token: "shpat_x", expires_in: 3600 }, T0);
    const state = tokenState(token, at(HOUR));
    expect(state.state).toBe("needs-reauth");
    if (state.state === "needs-reauth") expect(state.reason).toBe("no-refresh-token");
  });
});

describe("ensureAccessToken", () => {
  it("does not refresh a token that is still good", async () => {
    const refresh = vi.fn();
    const result = await ensureAccessToken({
      token: readTokenResponse(EXPIRING, T0),
      now: () => at(MINUTE),
      refresh,
    });

    expect(result).toMatchObject({ ok: true, refreshed: false });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("refreshes inside the skew window and returns the new token", async () => {
    const refresh = vi.fn(async () => ({
      access_token: "shpat_fresh",
      expires_in: 3600,
      refresh_token: "shprt_rotated",
      refresh_token_expires_in: 7776000,
      scope: "read_products",
    }));

    const result = await ensureAccessToken({
      token: readTokenResponse(EXPIRING, T0),
      now: () => at(HOUR - MINUTE),
      refresh,
    });

    expect(refresh).toHaveBeenCalledWith("shprt_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.refreshed).toBe(true);
    expect(result.token.accessToken).toBe("shpat_fresh");
    expect(result.token.refreshToken).toBe("shprt_rotated");
    // Dated against the clock at the moment of the refresh, not the original.
    expect(result.token.accessExpiresAt).toEqual(at(HOUR - MINUTE + HOUR));
  });

  it("keeps the old refresh token when a refresh response omits one", async () => {
    // Absent is read as "unchanged" rather than "revoked". If that guess is
    // wrong the next refresh fails loudly into needs-reauth, which is a much
    // better failure than discarding a working credential.
    const refresh = vi.fn(async () => ({ access_token: "shpat_fresh", expires_in: 3600 }));
    const result = await ensureAccessToken({
      token: readTokenResponse(EXPIRING, T0),
      now: () => at(HOUR),
      refresh,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.token.refreshToken).toBe("shprt_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
  });

  it("reports needs-reauth rather than throwing when the refresh fails", async () => {
    // "This merchant must reinstall" is a state to record and degrade from, not
    // an exception to propagate up through a render.
    const refresh = vi.fn(async () => {
      throw new Error("invalid_grant");
    });

    const result = await ensureAccessToken({
      token: readTokenResponse(EXPIRING, T0),
      now: () => at(HOUR),
      refresh,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.needsReauth).toBe(true);
    expect(result.reason).toMatch(/invalid_grant/);
  });

  it("does not call refresh at all once the refresh token is dead", async () => {
    const refresh = vi.fn();
    const result = await ensureAccessToken({
      token: readTokenResponse(EXPIRING, T0),
      now: () => at(91 * DAY),
      refresh,
    });

    expect(refresh).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false, needsReauth: true, reason: "refresh-token-expired" });
  });

  it("never expires a non-expiring token", async () => {
    const refresh = vi.fn();
    const result = await ensureAccessToken({
      token: readTokenResponse({ access_token: "shpat_legacy" }, T0),
      now: () => at(5 * 365 * DAY),
      refresh,
    });

    expect(result).toMatchObject({ ok: true, refreshed: false });
    expect(refresh).not.toHaveBeenCalled();
  });
});
