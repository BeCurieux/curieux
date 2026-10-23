import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/env";
import { LOCAL_SESSION_COOKIE } from "@/lib/auth/local-session";
import { userClient } from "@/lib/supabase/clients";

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/", request.url), { status: 303 });
  if (serverEnv().EMPIRE_BACKEND === "local") {
    response.cookies.delete(LOCAL_SESSION_COOKIE);
    return response;
  }
  await (await userClient()).auth.signOut();
  return response;
}
