/**
 * Shopify's token endpoint: an ID token in, an expiring offline token out; and
 * a refresh token in, a fresh pair out.
 *
 * Both requests are as documented (fetched through the Shopify docs tool,
 * 2026-09-28):
 * https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens
 * https://shopify.dev/docs/apps/build/authentication-authorization/implement-token-exchange
 *
 * The transport is injected, so the tests exercise the exact request body
 * without a network.
 */

import type { AdminTransport } from "../shopify/admin/client.js";
import type { TokenResponse } from "../shopify/token.js";

export class TokenEndpointError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`Shopify's token endpoint answered ${status}`);
    this.name = "TokenEndpointError";
  }

  /**
   * A 400 from the exchange means the ID token was expired or invalid —
   * routine, since it lives a minute. The docs say to answer the browser with a
   * 401 and the retry header so App Bridge fetches a fresh one.
   */
  get retryWithFreshIdToken(): boolean {
    return this.status === 400;
  }
}

export function tokenEndpoint(shop: string): string {
  return `https://${shop}/admin/oauth/access_token`;
}

export interface Credentials {
  clientId: string;
  clientSecret: string;
  transport: AdminTransport;
}

export async function exchangeIdToken(shop: string, idToken: string, creds: Credentials): Promise<TokenResponse> {
  return post(shop, creds, {
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
    subject_token: idToken,
    subject_token_type: "urn:ietf:params:oauth:token-type:id_token",
    requested_token_type: "urn:shopify:params:oauth:token-type:offline-access-token",
    // "New public apps must use expiring offline access tokens."
    expiring: "1",
  });
}

export async function refreshAccessToken(shop: string, refreshToken: string, creds: Credentials): Promise<TokenResponse> {
  return post(shop, creds, {
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
}

async function post(shop: string, creds: Credentials, fields: Record<string, string>): Promise<TokenResponse> {
  const response = await creds.transport(tokenEndpoint(shop), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams(fields).toString(),
  });
  const text = await response.text();
  if (!response.ok) throw new TokenEndpointError(response.status, text.slice(0, 500));

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new TokenEndpointError(response.status, "not JSON");
  }
  const token = json as Partial<TokenResponse>;
  if (typeof token.access_token !== "string" || token.access_token.length === 0) {
    throw new TokenEndpointError(response.status, "no access_token in the response");
  }
  return token as TokenResponse;
}
