import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { LOCAL_SESSION_COOKIE } from "@/lib/auth/local-session";

// Runs before every page request: refreshes the Supabase session cookie and
// sends signed-out visitors away from the studio. It only checks that a
// session exists. Pages still load the user and every query is scoped to
// her, so this is a convenience, not the security boundary.

const PROTECTED = ["/studio", "/account", "/admin"];

const isProtected = (pathname: string) =>
  PROTECTED.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

function toSignIn(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/sign-in";
  url.search = "";
  // Back to the page she asked for once she's signed in (checked again by safeNext).
  if (request.nextUrl.pathname !== "/studio")
    url.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if ((process.env.EMPIRE_BACKEND ?? "local") === "local") {
    if (isProtected(pathname) && !request.cookies.get(LOCAL_SESSION_COOKIE))
      return toSignIn(request);
    return NextResponse.next();
  }

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

  // getUser() validates the token with Supabase Auth. Nothing between
  // creating the client and this call.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isProtected(pathname)) return toSignIn(request);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|api/billing|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
