/**
 * The Admin API client, against a fake transport.
 *
 * Nothing here has reached Shopify. What these prove is the request this client
 * would send and how it reads the four answers that are easy to misread — a 200
 * carrying errors, a 401, a throttle, and a body that is not JSON.
 */

import { describe, expect, it, vi } from "vitest";
import {
  adminEndpoint,
  AdminApiError,
  createAdminClient,
  DEFAULT_API_VERSION,
  type AdminTransport,
} from "@/lib/shopify/admin/client";

const SHOP = "kelp-and-cotton.myshopify.com";
const TOKEN = "shpat_0000000000000000000000000000";

function ok(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const DATA = { products: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } };

describe("adminEndpoint", () => {
  it("builds the documented GraphQL URL", () => {
    // "/admin/api/{version}/graphql.json" — versioning guide.
    expect(adminEndpoint(SHOP, "2026-07")).toBe(
      "https://kelp-and-cotton.myshopify.com/admin/api/2026-07/graphql.json",
    );
  });

  it("pins a version rather than letting the API pick one", () => {
    // An omitted version defaults to "the oldest supported stable version",
    // which is the worst available choice and moves under you every quarter.
    expect(DEFAULT_API_VERSION).toMatch(/^\d{4}-\d{2}$/);
    expect(adminEndpoint(SHOP, DEFAULT_API_VERSION)).toContain(`/admin/api/${DEFAULT_API_VERSION}/`);
  });
});

describe("createAdminClient", () => {
  it("sends the access token in the documented header", async () => {
    const transport = vi.fn<AdminTransport>(async () => ok({ data: DATA }));
    const client = createAdminClient({ shopDomain: SHOP, accessToken: TOKEN, transport });

    await client.request("query { products(first: 1) { nodes { id } } }");

    const [url, init] = transport.mock.calls[0]!;
    expect(url).toBe(`https://${SHOP}/admin/api/${DEFAULT_API_VERSION}/graphql.json`);
    expect(init.method).toBe("POST");
    expect(init.headers["X-Shopify-Access-Token"]).toBe(TOKEN);
    expect(init.headers["content-type"]).toBe("application/json");
  });

  it("sends variables alongside the query", async () => {
    const transport = vi.fn<AdminTransport>(async () => ok({ data: DATA }));
    const client = createAdminClient({ shopDomain: SHOP, accessToken: TOKEN, transport });

    await client.request("query Q($first: Int!) { x }", { first: 50 });

    const body = JSON.parse(transport.mock.calls[0]![1].body);
    expect(body.variables).toEqual({ first: 50 });
  });

  it("asks the token provider on every request, so a refresh is picked up", async () => {
    const tokens = ["shpat_first", "shpat_second"];
    let i = 0;
    const transport = vi.fn<AdminTransport>(async () => ok({ data: DATA }));
    const client = createAdminClient({
      shopDomain: SHOP,
      accessToken: async () => tokens[i++] ?? "shpat_exhausted",
      transport,
    });

    await client.request("query { a }");
    await client.request("query { b }");

    expect(transport.mock.calls[0]![1].headers["X-Shopify-Access-Token"]).toBe("shpat_first");
    expect(transport.mock.calls[1]![1].headers["X-Shopify-Access-Token"]).toBe("shpat_second");
  });

  it("treats a 200 carrying errors as a failure", async () => {
    // The behaviour this client mostly exists for: "the GraphQL API can return
    // a 200 OK response code in cases that would typically produce 4xx or 5xx
    // errors in REST". `response.ok` is true and `data` may be partly filled;
    // reading that as success ships half a catalogue.
    const transport = vi.fn<AdminTransport>(async () =>
      ok({ data: { products: null }, errors: [{ message: "Field 'nope' doesn't exist" }] }),
    );
    const client = createAdminClient({ shopDomain: SHOP, accessToken: TOKEN, transport });

    await expect(client.request("query { nope }")).rejects.toThrow(AdminApiError);
    await expect(client.request("query { nope }")).rejects.toThrow(/doesn't exist/);
  });

  it("classifies a THROTTLED graphql error as throttled, not as a query bug", async () => {
    const transport = vi.fn<AdminTransport>(async () =>
      ok({ errors: [{ message: "Throttled", extensions: { code: "THROTTLED" } }] }),
    );
    const client = createAdminClient({ shopDomain: SHOP, accessToken: TOKEN, transport });

    // The difference matters: one is retryable in a minute, the other is never
    // retryable and needs a code change.
    await expect(client.request("query { a }")).rejects.toMatchObject({ kind: "throttled" });
  });

  it("surfaces the cost and throttle budget the API reports", async () => {
    // Rate limits are calculated query costs, reported on every response. A
    // backfill that does not read these is one that discovers the ceiling by
    // hitting it.
    const transport = vi.fn<AdminTransport>(async () =>
      ok({
        data: DATA,
        extensions: {
          cost: {
            requestedQueryCost: 302,
            actualQueryCost: 118,
            throttleStatus: { maximumAvailable: 1000, currentlyAvailable: 882, restoreRate: 50 },
          },
        },
      }),
    );
    const client = createAdminClient({ shopDomain: SHOP, accessToken: TOKEN, transport });

    const result = await client.request("query { a }");
    expect(result.requestedQueryCost).toBe(302);
    expect(result.actualQueryCost).toBe(118);
    expect(result.throttle).toEqual({
      maximumAvailable: 1000,
      currentlyAvailable: 882,
      restoreRate: 50,
    });
  });

  it("reports no cost rather than zero when the API did not say", async () => {
    // Zero would read as "this query was free", which is a different and wrong
    // claim — the same distinction `availabilityKnown` draws in the ingester.
    const transport = vi.fn<AdminTransport>(async () => ok({ data: DATA }));
    const client = createAdminClient({ shopDomain: SHOP, accessToken: TOKEN, transport });

    const result = await client.request("query { a }");
    expect(result.requestedQueryCost).toBeNull();
    expect(result.throttle).toBeNull();
  });

  it("refreshes once on a 401 and retries once", async () => {
    let calls = 0;
    const transport = vi.fn<AdminTransport>(async () => {
      calls++;
      return calls === 1 ? ok({ errors: ["unauthorized"] }, 401) : ok({ data: DATA });
    });
    const onUnauthorized = vi.fn();
    const client = createAdminClient({
      shopDomain: SHOP,
      accessToken: TOKEN,
      transport,
      onUnauthorized,
    });

    const result = await client.request("query { a }");
    expect(result.data).toEqual(DATA);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it("gives up after one failed retry rather than looping", async () => {
    // A token that is still rejected after a refresh is not coming back, and a
    // second refresh is a loop against an authorisation that no longer exists.
    const transport = vi.fn<AdminTransport>(async () => ok({ errors: ["unauthorized"] }, 401));
    const onUnauthorized = vi.fn();
    const client = createAdminClient({
      shopDomain: SHOP,
      accessToken: TOKEN,
      transport,
      onUnauthorized,
    });

    await expect(client.request("query { a }")).rejects.toMatchObject({ kind: "unauthorized" });
    expect(transport).toHaveBeenCalledTimes(2);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("does not retry a 403, which is a missing scope rather than a stale token", async () => {
    const transport = vi.fn<AdminTransport>(async () => ok({ errors: ["forbidden"] }, 403));
    const onUnauthorized = vi.fn();
    const client = createAdminClient({
      shopDomain: SHOP,
      accessToken: TOKEN,
      transport,
      onUnauthorized,
    });

    await expect(client.request("query { a }")).rejects.toMatchObject({ kind: "unauthorized" });
    expect(transport).toHaveBeenCalledTimes(1);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("classifies a 429 as throttled", async () => {
    const transport = vi.fn<AdminTransport>(async () => ok({}, 429));
    const client = createAdminClient({ shopDomain: SHOP, accessToken: TOKEN, transport });
    await expect(client.request("query { a }")).rejects.toMatchObject({
      kind: "throttled",
      status: 429,
    });
  });

  it("classifies a 5xx and a dead transport as transport failures", async () => {
    const server = createAdminClient({
      shopDomain: SHOP,
      accessToken: TOKEN,
      transport: async () => ok({}, 503),
    });
    await expect(server.request("query { a }")).rejects.toMatchObject({ kind: "transport" });

    const dead = createAdminClient({
      shopDomain: SHOP,
      accessToken: TOKEN,
      transport: async () => {
        throw new Error("ECONNREFUSED");
      },
    });
    await expect(dead.request("query { a }")).rejects.toMatchObject({ kind: "transport" });
  });

  it("refuses a 200 whose body is not JSON", async () => {
    const transport: AdminTransport = async () =>
      new Response("<html>maintenance</html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    const client = createAdminClient({ shopDomain: SHOP, accessToken: TOKEN, transport });
    await expect(client.request("query { a }")).rejects.toMatchObject({ kind: "transport" });
  });

  it("refuses a 200 with neither data nor errors", async () => {
    const transport: AdminTransport = async () => ok({});
    const client = createAdminClient({ shopDomain: SHOP, accessToken: TOKEN, transport });
    await expect(client.request("query { a }")).rejects.toMatchObject({ kind: "graphql" });
  });
});
