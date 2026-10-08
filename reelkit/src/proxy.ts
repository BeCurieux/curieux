import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Runs before requests and keeps the Supabase session cookie fresh, so route
// handlers can read who is signed in without each one refreshing tokens.
// With accounts off (no Supabase configured) it does nothing. The same
// arrangement as mavya/src/proxy.ts.

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  let response = NextResponse.next({ request });
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  // Validates and, when needed, refreshes the session. Nothing between the
  // client and this call.
  await supabase.auth.getUser();
  return response;
}

export const config = {
  // Not the image proxy, the Stripe webhook, or static files: none of them
  // care who is signed in.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/image|api/billing/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp4)$).*)"],
};
