import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/auth/next-path";
import { NEXT_COOKIE } from "@/lib/auth/next-cookie";
import { userClient } from "@/lib/supabase/server";

// Where the emailed sign-in link lands.
//
// The magic-link template (supabase/templates/magic_link.html) links here
// with ?token_hash=…&type=email. Verifying a token hash works in any
// browser, so she can ask on her laptop and tap the link on her phone.
// Supabase's default template sends ?code=… instead, which only works in
// the browser that asked; that is handled too, so a project still on the
// default template signs people in rather than failing.

const OTP_TYPES = new Set<EmailOtpType>(["email", "magiclink", "signup"]);

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const code = params.get("code");
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url));

  const supabase = await userClient();
  let userId: string | undefined;
  if (tokenHash && type && OTP_TYPES.has(type)) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) console.error("auth confirm:", error.name, error.message);
    userId = data.user?.id;
  } else if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) console.error("auth confirm (code):", error.name, error.message);
    userId = data.user?.id;
  } else {
    console.error("auth confirm: no token", params.get("error_description") ?? "");
  }
  if (!userId) return to("/login?error=1");

  // Her country, from Vercel's geo header, the first time we see her. It
  // picks AUD or USD at checkout. Never overwritten once set.
  const country = request.headers.get("x-vercel-ip-country")?.toUpperCase();
  if (country && /^[A-Z]{2}$/.test(country)) {
    const { error } = await supabase
      .from("profiles")
      .update({ country })
      .eq("user_id", userId)
      .is("country", null);
    if (error) console.error("auth confirm: country", error.message);
  }

  const response = to(safeNext(request.cookies.get(NEXT_COOKIE)?.value));
  response.cookies.delete(NEXT_COOKIE);
  return response;
}
