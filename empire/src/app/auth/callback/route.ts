import { NextResponse, type NextRequest } from "next/server";
import { afterSignIn } from "@/lib/auth/after-sign-in";
import { NEXT_COOKIE, safeNext } from "@/lib/auth/next-path";
import { userClient } from "@/lib/supabase/clients";

// Where the emailed sign-in link lands. Exchanges the one-time code for a
// session cookie, then sends her into the studio. Redirects stay on the host
// the link came back to, where the session cookie is set.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url));
  if (!code) {
    console.error(
      "auth callback: no code",
      request.nextUrl.searchParams.get("error_description") ?? "",
    );
    return to("/sign-in?error=1");
  }
  const supabase = await userClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user?.email) {
    // Visible in the hosting logs; she just sees "ask for a new link".
    console.error("auth callback:", error?.name ?? "no user email", error?.message ?? "");
    return to("/sign-in?error=1");
  }
  await afterSignIn({ id: data.user.id, email: data.user.email, createdAt: data.user.created_at });
  const response = to(safeNext(request.cookies.get(NEXT_COOKIE)?.value));
  response.cookies.delete(NEXT_COOKIE);
  return response;
}
