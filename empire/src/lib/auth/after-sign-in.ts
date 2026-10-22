import "server-only";
import { cookies } from "next/headers";
import { billingDeps } from "@/lib/billing";
import { claimByEmail } from "@/lib/billing/service";
import { SOURCE_COOKIE, track } from "@/lib/analytics/track";

// Runs once each time someone signs in. Attaches any purchases made with her
// (now verified) email, and counts a signup the first time we see her.
export async function afterSignIn(user: { id: string; email: string; createdAt: string }) {
  try {
    await claimByEmail(billingDeps(), user.id, user.email);
  } catch (error) {
    console.error("claim purchases", error instanceof Error ? error.message : error);
  }
  if (Date.now() - Date.parse(user.createdAt) < 10 * 60_000) {
    const source = (await cookies()).get(SOURCE_COOKIE)?.value ?? "direct";
    await track("signup_completed", user.id, { source });
  }
}
