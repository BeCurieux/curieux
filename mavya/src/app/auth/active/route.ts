import { NextResponse } from "next/server";
import { LAST_SEEN_COOKIE, lastSeenCookie } from "@/lib/auth/idle";
import { createClient } from "@/lib/supabase/server";

// The instructor app's taps are server actions, which can't set cookies
// without refreshing the page, so the browser reports activity here instead
// (src/components/shell/idle-sign-out.tsx). Only a signed-in person gets the
// cookie.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const response = new NextResponse(null, { status: 204 });
  response.cookies.set(LAST_SEEN_COOKIE, String(Date.now()), lastSeenCookie);
  return response;
}
