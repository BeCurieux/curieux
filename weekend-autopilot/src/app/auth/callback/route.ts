import { NextResponse, type NextRequest } from "next/server";
import { userClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/security/sanitise";

/**
 * Magic-link callback.
 *
 * The redirect target is validated before use (§50). An emailed link is
 * attacker-influenced input: without this, `?next=https://evil.example` would
 * turn our own auth flow into a credible phishing hop.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeRedirectPath(searchParams.get("next"), "/app");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const { error } = await userClient().auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=exchange_failed`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
