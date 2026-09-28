/**
 * Who is asking, and a working Admin API client for their shop.
 *
 * Every request from the embedded page carries App Bridge's ID token. This
 * verifies it, then makes sure the shop has a usable offline token — by token
 * exchange on first contact or after the installation lapsed, by refresh when
 * the access token is near expiry. The page never sees an access token.
 *
 * Webhooks have no ID token, so they reach the Admin API through
 * `accessTokenFor`, which can refresh but cannot re-acquire: an installation
 * whose refresh token has died waits for the merchant to open the app.
 */

import { createAdminClient, type AdminClient } from "../shopify/admin/client.js";
import { bearerToken, verifyIdToken } from "../shopify/idToken.js";
import { ensureAccessToken, readTokenResponse, type TokenSet } from "../shopify/token.js";
import type { AppConfig } from "./config.js";
import { exchangeIdToken, refreshAccessToken, TokenEndpointError, type Credentials } from "./oauth.js";
import type { AppStore, Installation } from "./store.js";
import type { AdminTransport } from "../shopify/admin/client.js";

export interface Deps {
  config: AppConfig;
  store: AppStore;
  transport: AdminTransport;
  now: () => Date;
}

export type Session = { shop: string; installation: Installation; admin: AdminClient };

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

  const held = await deps.store.getInstallation(shop);

  if (held && held.state === "active") {
    const ensured = await ensureAccessToken({
      token: held.token,
      now: deps.now,
      refresh: (refreshToken) => refreshAccessToken(shop, refreshToken, credentials(deps)),
    });
    if (ensured.ok) {
      const installation = ensured.refreshed ? await save(deps, { ...held, token: ensured.token }) : held;
      return { ok: true, session: sessionFor(installation, deps) };
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

  const now = deps.now().toISOString();
  const installation = await save(deps, {
    shop,
    token,
    state: "active",
    // Kept across a reinstall or a lapse: the merchant chose these.
    markets: held?.markets ?? null,
    lastKnownPlan: held?.lastKnownPlan ?? null,
    installedAt: held && held.state !== "uninstalled" ? held.installedAt : now,
    updatedAt: now,
  });
  return { ok: true, session: sessionFor(installation, deps) };
}

/**
 * An access token for background work, or null when the installation cannot
 * be used without the merchant. Records `needs_reauth` when that is the reason.
 */
export async function accessTokenFor(installation: Installation, deps: Deps): Promise<string | null> {
  if (installation.state !== "active") return null;
  const ensured = await ensureAccessToken({
    token: installation.token,
    now: deps.now,
    refresh: (refreshToken) => refreshAccessToken(installation.shop, refreshToken, credentials(deps)),
  });
  if (ensured.ok) {
    if (ensured.refreshed) await save(deps, { ...installation, token: ensured.token });
    return ensured.token.accessToken;
  }
  if (isDead(ensured.reason)) await save(deps, { ...installation, state: "needs_reauth" });
  return null;
}

export function adminFor(shop: string, accessToken: string, deps: Deps): AdminClient {
  return createAdminClient({ shopDomain: shop, accessToken, transport: deps.transport });
}

function sessionFor(installation: Installation, deps: Deps): Session {
  return {
    shop: installation.shop,
    installation,
    admin: adminFor(installation.shop, installation.token.accessToken, deps),
  };
}

/**
 * `ensureAccessToken` reports a failed refresh request and an unusable
 * refresh token the same way. Only the second means the installation is dead;
 * a network blip must not be recorded as one.
 */
function isDead(reason: string): boolean {
  return reason === "no-refresh-token" || reason === "refresh-token-expired";
}

async function save(deps: Deps, installation: Installation): Promise<Installation> {
  const next = { ...installation, updatedAt: deps.now().toISOString() };
  await deps.store.putInstallation(next);
  return next;
}

function credentials(deps: Deps): Credentials {
  return {
    clientId: deps.config.clientId,
    clientSecret: deps.config.secrets[0] ?? "",
    transport: deps.transport,
  };
}
