import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Runs before page requests: refreshes the Supabase session cookie and sends
// signed-out visitors on signed-in pages to /login. It only checks that a
// session exists. Every gated page checks again on the server, and access
// to content is decided there (SPEC.md → Non-negotiables), so this is a
// convenience, not the security boundary.

const PROTECTED = ["/learn", "/tools", "/verdict", "/account", "/checkout", "/admin"];

export const isProtected = (pathname: string) =>
  PROTECTED.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          for (const { name, value } of toSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
        },
      },
    },
  );

  // Nothing between creating the client and this call.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;
  if (!user && isProtected(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  // Not the webhook or other API routes (they check for themselves), not
  // static files. The public pages /check and /hype still pass through, so a
  // returning buyer's session stays fresh, but nothing there waits on it.
  matcher: [
    "/((?!api/|_next/static|_next/image|fonts/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2)$).*)",
  ],
};
