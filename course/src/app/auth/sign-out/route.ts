import { NextResponse, type NextRequest } from "next/server";
import { userClient } from "@/lib/supabase/server";

// POST only, from a form button, so a link or prefetch can't sign her out.
export async function POST(request: NextRequest) {
  const supabase = await userClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
