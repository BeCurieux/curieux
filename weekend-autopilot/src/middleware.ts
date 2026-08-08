import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Session refresh.
 *
 * Server components cannot write cookies, so the refreshed Supabase session
 * has to be persisted here or a returning customer is silently logged out
 * whenever their access token expires — which, for a product people open once
 * a week from an email, would be almost every time.
 */
export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request: { headers: request.headers } });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      get: (name: string) => request.cookies.get(name)?.value,
      set: (name: string, value: string, options: CookieOptions) => {
        response.cookies.set({ name, value, ...options });
      },
      remove: (name: string, options: CookieOptions) => {
        response.cookies.set({ name, value: "", ...options, maxAge: 0 });
      },
    },
  });

  await supabase.auth.getUser();
  return response;
}

export const config = {
  // Static assets and the Stripe webhook are excluded: the webhook has no
  // session, and running auth on it would waste a round trip on every event.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|api/stripe|.*\\.png$).*)"],
};
