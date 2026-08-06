// Replace the session cookies with tokens the browser has just been issued.
//
// Only the step-up flow needs this. Verifying an MFA challenge happens in the
// browser and returns a *new* access token carrying aal2; the server holds
// its own copy in an httpOnly cookie and would otherwise keep reading the old
// aal1 one, bouncing the parent back to the confirmation screen forever.
//
// The tokens are not trusted because they were posted here. Every one is
// checked against the auth server before a cookie is written — otherwise this
// endpoint would be a way to hand the server any token at all.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const accessToken = typeof body?.access_token === "string" ? body.access_token : null;
  const refreshToken = typeof body?.refresh_token === "string" ? body.refresh_token : null;
  if (!accessToken || !refreshToken) {
    return NextResponse.json({ error: "tokens required" }, { status: 400 });
  }

  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  // The round trip that makes this safe: a forged or expired token fails
  // here and never reaches a cookie.
  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) {
    return NextResponse.json({ error: "that token is not valid" }, { status: 401 });
  }

  // Same options as the sign-in path. httpOnly so no script can read it back
  // out, and the access cookie stays short-lived.
  const opts = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" };
  cookies().set(ACCESS_COOKIE, accessToken, { ...opts, maxAge: 60 * 60 });
  cookies().set(REFRESH_COOKIE, refreshToken, { ...opts, maxAge: 60 * 60 * 24 * 30 });

  return NextResponse.json({ ok: true });
}
