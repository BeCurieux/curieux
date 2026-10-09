/**
 * Who is asking, and a working Admin API client for their shop.
 *
 * Adapted from tildie/src/server/session.ts. Every request from the embedded
 * page carries App Bridge's ID token: this verifies it, then makes sure the
 * shop has a usable offline token — by token exchange on first contact (that
 * is the install: scopes are Shopify-managed, declared in shopify.app.toml),
 * by refresh near expiry. The page never sees an access token.
 *
 * Webhooks have no ID token, so background work reaches the Admin API through
 * `accessTokenFor`, which can refresh but cannot re-acquire.
 */

import { createAdminClient, type AdminClient, type AdminTransport } from "../shopify/admin/client.js";
import { bearerToken, verifyIdToken } from "../shopify/idToken.js";
import { ensureAccessToken, readTokenResponse, type TokenSet } from "../shopify/token.js";
import type { AppConfig } from "./config.js";
import { exchangeIdToken, refreshAccessToken, TokenEndpointError, type Credentials } from "./oauth.js";
import type { AppStore, Merchant } from "./store.js";

export interface Deps {
  config: AppConfig;
  store: AppStore;
  transport: AdminTransport;
  now: () => Date;
}

export type Session = { shop: string; merchant: Merchant; admin: AdminClient };
export type AuthResult = { ok: true; session: Session } | { ok: false; response: Response };

/** The header that tells App Bridge to fetch a fresh ID token and retry. */
export const RETRY_HEADER = "X-Shopify-Retry-Invalid-Session-Request";

export function unauthorised(reason: string): Response {
  return Response.json({ error: "unauthorised", reason }, { status: 401, headers: { [RETRY_HEADER]: "1" } });
}

export async function authenticate(request: Request, deps: Deps): Promise<AuthResult> {
  const idToken = bearerToken(request.headers.get("authorization"));
  const verified = verifyIdToken({
    token: idToken,
    clientId: deps.config.clientId,
    secrets: deps.config.secrets,
    now: () => deps.now().getTime(),
  });
  if (!verified.ok) return { ok: false, response: unauthorised(verified.reason) };
  const shop = verified.shop;

  const held = await deps.store.getMerchant(shop);

  if (held && held.state === "active" && held.token) {
    const ensured = await ensureAccessToken({
      token: held.token,
      now: deps.now,
      refresh: (refreshToken) => refreshAccessToken(shop, refreshToken, credentials(deps)),
    });
    if (ensured.ok) {
      const merchant = ensured.refreshed ? await deps.store.putMerchant({ ...held, token: ensured.token }) : held;
      return { ok: true, session: sessionFor(merchant, deps) };
    }
    if (!isDead(ensured.reason)) {
      return { ok: false, response: Response.json({ error: "token-refresh-failed" }, { status: 503 }) };
    }
    // The refresh token is gone; the merchant is here with an ID token, which
    // is exactly what re-acquiring needs. Fall through to the exchange.
  }

  let token: TokenSet;
  try {
    token = readTokenResponse(await exchangeIdToken(shop, idToken as string, credentials(deps)), deps.now());
  } catch (error) {
    if (error instanceof TokenEndpointError && error.retryWithFreshIdToken) {
      return { ok: false, response: unauthorised("token-exchange-rejected") };
    }
    return { ok: false, response: Response.json({ error: "token-exchange-failed" }, { status: 502 }) };
  }

  const merchant = await deps.store.putMerchant({
    shop,
    token,
    state: "active",
    plan: held?.plan ?? null,
    originMarket: held?.originMarket ?? null,
    // A reinstall is a new installation; a lapsed token is not.
    installedAt: held && held.state !== "uninstalled" ? held.installedAt : deps.now().toISOString(),
    uninstalledAt: null,
  });
  return { ok: true, session: sessionFor(merchant, deps) };
}

/** An access token for background work, or null when the merchant must return. */
export async function accessTokenFor(merchant: Merchant, deps: Deps): Promise<string | null> {
  if (merchant.state !== "active" || !merchant.token) return null;
  const ensured = await ensureAccessToken({
    token: merchant.token,
    now: deps.now,
    refresh: (refreshToken) => refreshAccessToken(merchant.shop, refreshToken, credentials(deps)),
  });
  if (ensured.ok) {
    if (ensured.refreshed) await deps.store.putMerchant({ ...merchant, token: ensured.token });
    return ensured.token.accessToken;
  }
  if (isDead(ensured.reason)) await deps.store.putMerchant({ ...merchant, state: "needs_reauth" });
  return null;
}

function sessionFor(merchant: Merchant, deps: Deps): Session {
  return {
    shop: merchant.shop,
    merchant,
    admin: createAdminClient({ shopDomain: merchant.shop, accessToken: merchant.token?.accessToken ?? "", transport: deps.transport }),
  };
}

/** A failed refresh request is not a dead installation; an unusable refresh token is. */
function isDead(reason: string): boolean {
  return reason === "no-refresh-token" || reason === "refresh-token-expired";
}

function credentials(deps: Deps): Credentials {
  return { clientId: deps.config.clientId, clientSecret: deps.config.secrets[0] ?? "", transport: deps.transport };
}
