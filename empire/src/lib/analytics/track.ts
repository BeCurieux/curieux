import "server-only";
import { cookies } from "next/headers";
import { systemRepo } from "@/lib/data";

// First-party product analytics. Events go to our own database — no
// advertising platform, no third-party script — and carry only coarse,
// allow-listed properties: never a brand name, product detail or any text a
// customer wrote. docs/ANALYTICS.md lists the events and what they answer.
//
// Anonymous visitors get an identifier only after accepting the analytics
// cookie (src/components/consent.tsx). Without consent, events are still
// counted, but can't be linked to each other.

export const EVENTS = [
  "landing_viewed",
  "pricing_viewed",
  "preview_started",
  "signup_completed",
  "profile_completed",
  "generation_requested",
  "generation_succeeded",
  "generation_failed",
  "asset_edited",
  "asset_copied",
  "asset_downloaded",
  "pack_exported",
  "checkout_started",
  "purchase_verified",
  "purchase_refunded",
  "task_updated",
  "fit_completed",
  "calculator_viewed",
  "offer_clicked",
] as const;
export type EventName = (typeof EVENTS)[number];

const ALLOWED_PROPS = new Set([
  "module",
  "source",
  "plan",
  "section",
  "status",
  "format",
  "path",
  "reason",
  "product_type",
]);

export const CONSENT_COOKIE = "empire_consent";
export const ANON_COOKIE = "empire_anon";
export const SOURCE_COOKIE = "empire_source";

export function cleanProps(
  props: Record<string, unknown>,
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(props)) {
    if (!ALLOWED_PROPS.has(key)) continue;
    if (typeof value === "number" || typeof value === "boolean") out[key] = value;
    else if (typeof value === "string") out[key] = value.slice(0, 60).replace(/[^\w:/.-]/g, "_");
  }
  return out;
}

export async function track(
  name: EventName,
  userId: string | null,
  props: Record<string, unknown> = {},
): Promise<void> {
  try {
    let anonymousId: string | null = null;
    try {
      const jar = await cookies();
      if (jar.get(CONSENT_COOKIE)?.value === "yes")
        anonymousId = jar.get(ANON_COOKIE)?.value ?? null;
    } catch {
      // Outside a request (tests, cron): no cookies, no anonymous id.
    }
    await systemRepo().track({
      name,
      userId,
      anonymousId: anonymousId?.slice(0, 64) ?? null,
      props: cleanProps(props),
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    // Analytics must never break the thing being measured.
    console.error("analytics", name, error instanceof Error ? error.message : error);
  }
}
