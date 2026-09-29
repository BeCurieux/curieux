import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/env";
import { isIdle, isInstructorPath, LAST_SEEN_COOKIE, lastSeenCookie } from "@/lib/auth/idle";

// Runs before every page request. It refreshes the Supabase session cookie,
// sends signed-out visitors to sign-in, and signs out an instructor who has
// been idle too long (src/lib/auth/idle.ts). "/" is public: signed out, it is
// the website; signed in, the page itself sends people to their shell. It does not decide which roles
// may open which shell: each shell's layout checks that against the database.

const PROTECTED_PREFIXES = ["/business", "/instructor", "/family", "/no-access"];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = publicEnv();

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getUser() asks Supabase Auth to validate the token. Don't put code
  // between creating the client and this call.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && isProtected(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (user && isInstructorPath(pathname) && isIdle(request.cookies.get(LAST_SEEN_COOKIE)?.value)) {
    await supabase.auth.signOut({ scope: "local" });
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = "?idle=1";
    const redirect = NextResponse.redirect(url);
    // Carry over the cleared session cookies from signOut.
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    redirect.cookies.delete(LAST_SEEN_COOKIE);
    return redirect;
  }

  // Not on a server action's response: a cookie set there makes the page
  // refresh and lose its form state. The browser reports activity during
  // actions itself (/auth/active).
  if (user && isProtected(pathname) && !request.headers.has("next-action")) {
    response.cookies.set(LAST_SEEN_COOKIE, String(Date.now()), lastSeenCookie);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp4)$).*)",
  ],
};
