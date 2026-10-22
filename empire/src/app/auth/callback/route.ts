import { NextResponse, type NextRequest } from "next/server";
import { appUrl } from "@/env";
import { afterSignIn } from "@/lib/auth/after-sign-in";
import { userClient } from "@/lib/supabase/clients";

// Where the emailed sign-in link lands. Exchanges the one-time code for a
// session cookie, then sends her into the studio.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(`${appUrl()}/sign-in?error=1`);
  const supabase = await userClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user?.email) return NextResponse.redirect(`${appUrl()}/sign-in?error=1`);
  await afterSignIn({ id: data.user.id, email: data.user.email, createdAt: data.user.created_at });
  return NextResponse.redirect(`${appUrl()}/studio`);
}
