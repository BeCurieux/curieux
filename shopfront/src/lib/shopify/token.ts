/**
 * The expiring-offline-token lifecycle.
 *
 * New public apps are told to request expiring offline tokens and persist the
 * refresh token (SHOPIFY-APP.md §4.2). The documented response carries
 * `expires_in` and `refresh_token_expires_in`; the documented example values
 * are one hour and ninety days.
 *
 * **No lifetime is hardcoded here.** The example values in the docs are an
 * example, this environment cannot observe a real exchange, and an app that
 * assumed 3600 would be wrong the day it changed. Everything below reads what
 * the response said. A token that came back without `expires_in` is treated as
 * non-expiring, which is both the safe reading and the legacy shape.
 *
 * The clock is an argument for the same reason the ingester's fetch is: the
 * whole point of this file is behaviour over time, and a test that has to wait
 * an hour to check an hour-long expiry is not a test anybody runs.
 */

/** What a token exchange or refresh gave us, normalised. */
export interface TokenSet {
  accessToken: string;
  /** Null when the response carried none — i.e. a non-expiring token. */
  refreshToken: string | null;
  /** Null means non-expiring. */
  accessExpiresAt: Date | null;
  refreshExpiresAt: Date | null;
  /** As granted. Not as requested — those can differ, and can change later. */
  scopes: string[];
}

/** The documented shape of a token response. Every field optional but the token. */
export interface TokenResponse {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope?: string;
}

/**
 * A token response -> a `TokenSet`, dated against the clock that received it.
 *
 * `expires_in` is relative, so the moment of receipt is part of the meaning and
 * has to be captured here rather than inferred later.
 */
export function readTokenResponse(response: TokenResponse, receivedAt: Date): TokenSet {
  const at = (seconds: number | undefined): Date | null =>
    typeof seconds === "number" && Number.isFinite(seconds)
      ? new Date(receivedAt.getTime() + seconds * 1000)
      : null;

  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token ?? null,
    accessExpiresAt: at(response.expires_in),
    refreshExpiresAt: at(response.refresh_token_expires_in),
    // Shopify returns scopes comma-separated ("write_products,read_orders").
    scopes: (response.scope ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  };
}

/**
 * How long before expiry a token is treated as already expired.
 *
 * Refreshing reactively — call, take a 401, refresh, retry — spends a failed
 * request every cycle and turns any clock skew between us and Shopify into a
 * user-visible failure. Five minutes is comfortably more than the round trip
 * and comfortably less than any plausible token lifetime.
 */
export const REFRESH_SKEW_MS = 5 * 60_000;

export function accessTokenUsable(token: TokenSet, now: Date, skewMs = REFRESH_SKEW_MS): boolean {
  if (!token.accessExpiresAt) return true;
  return token.accessExpiresAt.getTime() - skewMs > now.getTime();
}

/**
 * Can this installation still be refreshed without the merchant?
 *
 * False means the installation is dead in the sense that matters: the docs are
 * explicit that re-acquiring needs merchant interaction. It does *not* mean the
 * merchant's shop breaks — see `TokenState` below and §4.3.
 */
export function refreshable(token: TokenSet, now: Date): boolean {
  if (!token.refreshToken) return false;
  if (!token.refreshExpiresAt) return true;
  return token.refreshExpiresAt.getTime() > now.getTime();
}

export type TokenState =
  /** Usable now. */
  | { state: "ready"; token: TokenSet }
  /** Expired or nearly, and refreshable without the merchant. */
  | { state: "refresh" }
  /**
   * Expired and not refreshable. The merchant has to come back.
   *
   * This is where the public ingester earns its keep: an installation in this
   * state falls back to `/products.json`, so the shop stays current-ish and
   * stops claiming to be live, rather than going dark. That is only possible
   * because the credential-free path was never allowed to become second-class.
   */
  | { state: "needs-reauth"; reason: "no-refresh-token" | "refresh-token-expired" };

export function tokenState(token: TokenSet, now: Date, skewMs = REFRESH_SKEW_MS): TokenState {
  if (accessTokenUsable(token, now, skewMs)) return { state: "ready", token };
  if (!token.refreshToken) return { state: "needs-reauth", reason: "no-refresh-token" };
  if (!refreshable(token, now)) return { state: "needs-reauth", reason: "refresh-token-expired" };
  return { state: "refresh" };
}

/** Exchanges a refresh token for a new set. Injected; never implemented here. */
export type RefreshFn = (refreshToken: string) => Promise<TokenResponse>;

export interface EnsureOptions {
  token: TokenSet;
  now: () => Date;
  refresh: RefreshFn;
  skewMs?: number;
}

export type EnsureResult =
  | { ok: true; token: TokenSet; refreshed: boolean }
  | { ok: false; needsReauth: true; reason: string };

/**
 * Give me a usable token, refreshing if that is what it takes.
 *
 * Returns a result rather than throwing on the reauth path, because "this
 * merchant must reinstall" is a state to record and degrade from, not an
 * exception to propagate. A genuine transport failure inside `refresh` is a
 * different thing and is caught here too — a network blip must not be recorded
 * as a dead installation, so it is reported as needing reauth only after the
 * refresh token itself is known to be unusable.
 */
export async function ensureAccessToken(options: EnsureOptions): Promise<EnsureResult> {
  const { token, now, refresh, skewMs = REFRESH_SKEW_MS } = options;

  const state = tokenState(token, now(), skewMs);
  if (state.state === "ready") return { ok: true, token: state.token, refreshed: false };
  if (state.state === "needs-reauth") return { ok: false, needsReauth: true, reason: state.reason };

  const refreshToken = token.refreshToken;
  // Unreachable via `tokenState`, which only returns "refresh" when this is
  // set. Narrowing rather than asserting, so a future change to that function
  // cannot turn this into a runtime `undefined`.
  if (!refreshToken) return { ok: false, needsReauth: true, reason: "no-refresh-token" };

  let response: TokenResponse;
  try {
    response = await refresh(refreshToken);
  } catch (error) {
    return {
      ok: false,
      needsReauth: true,
      reason: `refresh failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const next = readTokenResponse(response, now());
  // A refresh that returns no refresh token would leave the installation
  // unable to refresh again. Carrying the old one forward is wrong if Shopify
  // rotated it and right if it simply did not repeat it; the docs show one in
  // the response, so an absent one is treated as "unchanged" rather than
  // "revoked" — and if that guess is wrong the next refresh fails loudly into
  // needs-reauth rather than silently.
  return {
    ok: true,
    token: { ...next, refreshToken: next.refreshToken ?? refreshToken },
    refreshed: true,
  };
}
