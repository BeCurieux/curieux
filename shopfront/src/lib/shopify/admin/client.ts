/**
 * The GraphQL Admin API client.
 *
 * The whole of it sits behind an interface with the transport injected, for the
 * same reason `lib/ingest/http.ts` does: everything above it is then pure, and
 * every test here runs against a fake rather than a network this environment
 * does not have. Nothing in this file has ever reached Shopify.
 *
 * GraphQL rather than REST is not a preference. Verified: "The REST Admin API
 * is a legacy API as of October 1, 2024. Starting April 1, 2025, all new public
 * apps must be built exclusively with the GraphQL Admin API."
 *
 * The two behaviours that surprise people, both verified and both handled
 * below: the GraphQL API returns **200 with an `errors` array** where REST
 * would return a 4xx, and it is rate-limited by **calculated query cost**
 * rather than request count, reporting the budget in
 * `extensions.cost.throttleStatus` on every response.
 */

/**
 * Pinned, never defaulted.
 *
 * Verified: versions are quarterly, each supported at least twelve months, with
 * at least nine months of overlap — and "If your request doesn't include a
 * version, then the API also defaults to the oldest supported stable version",
 * which is the worst of the available choices and moves under you.
 *
 * 2026-07 is the current stable at the time of writing: quarterly releases fall
 * in January, April, July and October, and shopify.dev's own examples use
 * 2026-07. **[unverified]** that it is still current when this runs — which is
 * exactly why it is a parameter with a named default rather than a literal
 * buried in a template string, and why the version in use is stored per
 * installation so a migration can be staged rather than flag-day'd.
 */
export const DEFAULT_API_VERSION = "2026-07";

export type AdminTransport = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<Response>;

/** Async so it can refresh. See `token.ts`; this is where the two meet. */
export type AccessTokenProvider = () => Promise<string>;

export interface AdminClientOptions {
  shopDomain: string;
  accessToken: string | AccessTokenProvider;
  apiVersion?: string;
  transport: AdminTransport;
  /**
   * Called when a request comes back 401 so the caller can invalidate whatever
   * it cached. The retry then asks `accessToken` again and gets a fresh one.
   */
  onUnauthorized?: () => Promise<void> | void;
}

/** What the API told us about our remaining budget, when it told us. */
export interface ThrottleStatus {
  maximumAvailable: number;
  currentlyAvailable: number;
  restoreRate: number;
}

export interface AdminResponse<T> {
  data: T;
  requestedQueryCost: number | null;
  actualQueryCost: number | null;
  throttle: ThrottleStatus | null;
}

export type AdminErrorKind =
  /** 401/403. The token is dead or the scope is missing. */
  | "unauthorized"
  /** 429, or a `THROTTLED` GraphQL error. Retryable, later. */
  | "throttled"
  /** 200 carrying an `errors` array. A real failure wearing a success code. */
  | "graphql"
  /** 5xx, or the transport itself failed. */
  | "transport"
  | "unknown";

export class AdminApiError extends Error {
  constructor(
    readonly kind: AdminErrorKind,
    message: string,
    readonly status: number | null = null,
  ) {
    super(message);
    this.name = "AdminApiError";
  }
}

export interface AdminClient {
  readonly shopDomain: string;
  readonly apiVersion: string;
  readonly endpoint: string;
  request<T>(query: string, variables?: Record<string, unknown>): Promise<AdminResponse<T>>;
}

/** `https://<shop>/admin/api/<version>/graphql.json`, and only that. */
export function adminEndpoint(shopDomain: string, apiVersion: string): string {
  return `https://${shopDomain}/admin/api/${apiVersion}/graphql.json`;
}

export function createAdminClient(options: AdminClientOptions): AdminClient {
  const { shopDomain, transport, onUnauthorized } = options;
  const apiVersion = options.apiVersion ?? DEFAULT_API_VERSION;
  const endpoint = adminEndpoint(shopDomain, apiVersion);

  const tokenFor: AccessTokenProvider =
    typeof options.accessToken === "string"
      ? async () => options.accessToken as string
      : options.accessToken;

  async function send(query: string, variables: Record<string, unknown> | undefined) {
    const token = await tokenFor();
    return transport(endpoint, {
      method: "POST",
      headers: {
        // The one header that makes this an Admin API call at all.
        "X-Shopify-Access-Token": token,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(variables ? { query, variables } : { query }),
    });
  }

  async function request<T>(
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<AdminResponse<T>> {
    let response: Response;
    try {
      response = await send(query, variables);
    } catch (error) {
      throw new AdminApiError(
        "transport",
        error instanceof Error ? error.message : String(error),
      );
    }

    // Exactly one retry, and only for 401. A token can be revoked or rotated
    // between the proactive refresh and the call; anything past one retry is a
    // loop against an authorisation that is not coming back.
    if (response.status === 401) {
      await onUnauthorized?.();
      try {
        response = await send(query, variables);
      } catch (error) {
        throw new AdminApiError(
          "transport",
          error instanceof Error ? error.message : String(error),
        );
      }
      if (response.status === 401) {
        throw new AdminApiError("unauthorized", "still 401 after refreshing", 401);
      }
    }

    if (response.status === 403) {
      // Usually a scope the app was never granted rather than a bad token.
      throw new AdminApiError("unauthorized", "forbidden — check granted scopes", 403);
    }
    if (response.status === 429) {
      throw new AdminApiError("throttled", "rate limited", 429);
    }
    if (response.status >= 500) {
      throw new AdminApiError("transport", `HTTP ${response.status}`, response.status);
    }
    if (!response.ok) {
      throw new AdminApiError("unknown", `HTTP ${response.status}`, response.status);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new AdminApiError("transport", "response was not JSON", response.status);
    }

    const body = isRecord(payload) ? payload : {};
    const { requestedQueryCost, actualQueryCost, throttle } = readCost(body["extensions"]);

    // A 200 carrying `errors` is the failure mode this whole client exists to
    // not get wrong: `response.ok` is true, `data` may even be partially
    // populated, and treating it as success ships half a catalogue.
    const errors = body["errors"];
    if (Array.isArray(errors) && errors.length > 0) {
      const messages = errors
        .map((e) => (isRecord(e) && typeof e["message"] === "string" ? e["message"] : "unknown"))
        .join("; ");
      const throttled = errors.some(
        (e) =>
          isRecord(e) &&
          isRecord(e["extensions"]) &&
          e["extensions"]["code"] === "THROTTLED",
      );
      throw new AdminApiError(throttled ? "throttled" : "graphql", messages, response.status);
    }

    if (body["data"] === undefined || body["data"] === null) {
      throw new AdminApiError("graphql", "response carried no data", response.status);
    }

    return {
      data: body["data"] as T,
      requestedQueryCost,
      actualQueryCost,
      throttle,
    };
  }

  return { shopDomain, apiVersion, endpoint, request };
}

function readCost(extensions: unknown): {
  requestedQueryCost: number | null;
  actualQueryCost: number | null;
  throttle: ThrottleStatus | null;
} {
  const empty = { requestedQueryCost: null, actualQueryCost: null, throttle: null };
  if (!isRecord(extensions)) return empty;
  const cost = extensions["cost"];
  if (!isRecord(cost)) return empty;

  const status = cost["throttleStatus"];
  const throttle = isRecord(status)
    ? {
        maximumAvailable: num(status["maximumAvailable"]) ?? 0,
        currentlyAvailable: num(status["currentlyAvailable"]) ?? 0,
        restoreRate: num(status["restoreRate"]) ?? 0,
      }
    : null;

  return {
    requestedQueryCost: num(cost["requestedQueryCost"]),
    actualQueryCost: num(cost["actualQueryCost"]),
    throttle,
  };
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
