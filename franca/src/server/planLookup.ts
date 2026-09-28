/**
 * Which plan is this shop on? Asked of the Partner API's `activeSubscription`,
 * which is where Shopify App Pricing keeps the answer.
 *
 * The query is the documented one
 * (https://shopify.dev/docs/api/partner/2026-07/active-subscription), trimmed.
 * [unverified] It could not be validated: the schema the docs tool validates
 * against predates `activeSubscription`. Also unverified: that an item's
 * `handle` is the plan handle set in the Partner Dashboard, and the endpoint's
 * path. Stage 4 checks all three against a development store.
 *
 * Whatever goes wrong becomes `unknown`, never `none` — see `accessFor`.
 */

import type { AdminClient } from "../shopify/admin/client.js";
import { isPlanHandle, type PlanHandle, type PlanLookup } from "../shopify/plans.js";
import type { Deps } from "./session.js";

export const PARTNER_API_VERSION = "2026-07";

export const ACTIVE_SUBSCRIPTION_QUERY = /* GraphQL */ `
  query FrancaActiveSubscription($appId: ID!, $shopId: ID!) {
    activeSubscription(appId: $appId, shopId: $shopId) {
      billingPeriod
      items {
        handle
      }
    }
  }
`;

export function partnerEndpoint(orgId: string): string {
  return `https://partners.shopify.com/${encodeURIComponent(orgId)}/api/${PARTNER_API_VERSION}/graphql.json`;
}

export async function lookupPlan(admin: AdminClient, lastKnown: PlanHandle | null, deps: Deps): Promise<PlanLookup> {
  if (deps.config.devPlan) return { kind: "active", handle: deps.config.devPlan };
  const partner = deps.config.partner;
  if (!partner) return { kind: "unknown", lastKnown };

  try {
    const shop = await admin.request<{ shop: { id: string } }>("query FrancaShopId { shop { id } }");
    const response = await deps.transport(partnerEndpoint(partner.orgId), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "X-Shopify-Access-Token": partner.token,
      },
      body: JSON.stringify({
        query: ACTIVE_SUBSCRIPTION_QUERY,
        variables: { appId: partner.appGid, shopId: shop.data.shop.id },
      }),
    });
    if (!response.ok) return { kind: "unknown", lastKnown };
    const body = (await response.json()) as {
      data?: { activeSubscription: { items?: Array<{ handle?: string }> } | null };
      errors?: unknown;
    };
    if (body.errors || !body.data) return { kind: "unknown", lastKnown };

    const subscription = body.data.activeSubscription;
    if (subscription === null) return { kind: "none" };
    const handles = (subscription.items ?? []).map((item) => item.handle).filter((h): h is string => Boolean(h));
    return { kind: "active", handle: handles.find(isPlanHandle) ?? handles[0] ?? "" };
  } catch {
    return { kind: "unknown", lastKnown };
  }
}
