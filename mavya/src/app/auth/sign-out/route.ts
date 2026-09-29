import { NextResponse, type NextRequest } from "next/server";
import { LAST_SEEN_COOKIE } from "@/lib/auth/idle";
import { createClient } from "@/lib/supabase/server";

// POST only, so a link or prefetch can never sign someone out. `?idle=1`
// comes from the instructor app's idle timer, so sign-in can say why.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  const idle = request.nextUrl.searchParams.get("idle") === "1";
  const response = NextResponse.redirect(
    new URL(idle ? "/sign-in?idle=1" : "/sign-in", request.url),
    {
      status: 303,
    },
  );
  response.cookies.delete(LAST_SEEN_COOKIE);
  return response;
}
