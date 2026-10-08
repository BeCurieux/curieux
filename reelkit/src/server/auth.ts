/**
 * Signing in with a code sent by email. No passwords to forget or leak, and
 * a code works when the seller reads the email on their phone but is making
 * ads on a laptop, which a link that must open in the same browser does not.
 *
 * The same email also carries a link (`/auth/confirm`) for people who would
 * rather tap. README.md has the email template that sends both.
 */

import { z } from "zod";
import { clientKey, windowLimiter } from "./limit.js";
import { sessionClient, type SupabaseEnv } from "./supabase.js";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

const Start = z.object({ email: z.string().trim().toLowerCase().email().max(254) });
const Verify = z.object({ email: z.string().trim().toLowerCase().email().max(254), code: z.string().trim().regex(/^\d{6,10}$/) });

// Supabase limits emails per address too; this stops one visitor spraying
// codes at many addresses from our domain.
const startLimit = windowLimiter(5, 15 * 60_000);
const verifyLimit = windowLimiter(20, 15 * 60_000);

async function read(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

export async function startSignIn(req: Request, env: SupabaseEnv, origin: string): Promise<Response> {
  if (!startLimit(clientKey(req))) return json({ error: "Too many codes requested. Wait a few minutes." }, 429);
  const parsed = Start.safeParse(await read(req));
  if (!parsed.success) return json({ error: "That email address doesn't look right." }, 400);
  const supabase = await sessionClient(env);
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { shouldCreateUser: true, emailRedirectTo: `${origin}/auth/confirm` },
  });
  if (error) {
    const limited = error.status === 429;
    return json(
      { error: limited ? "Too many codes requested for that address. Wait a few minutes." : "We couldn't send the code. Try again." },
      limited ? 429 : 502,
    );
  }
  return json({ sent: true });
}

export async function verifySignIn(req: Request, env: SupabaseEnv): Promise<Response> {
  if (!verifyLimit(clientKey(req))) return json({ error: "Too many tries. Wait a few minutes." }, 429);
  const parsed = Verify.safeParse(await read(req));
  if (!parsed.success) return json({ error: "Enter the code from the email." }, 400);
  const supabase = await sessionClient(env);
  const { data, error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.code,
    type: "email",
  });
  if (error || !data.user) return json({ error: "That code didn't work. It may have expired — ask for a new one." }, 400);
  return json({ signedIn: true });
}

export async function signOut(env: SupabaseEnv): Promise<Response> {
  const supabase = await sessionClient(env);
  await supabase.auth.signOut({ scope: "local" });
  return json({ signedOut: true });
}

/** The link in the email. Verifies the one-time hash and lands on the studio. */
export async function confirmLink(req: Request, env: SupabaseEnv): Promise<Response> {
  const url = new URL(req.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const home = new URL("/", url.origin);
  if (tokenHash && (type === "email" || type === "magiclink" || type === "signup")) {
    const supabase = await sessionClient(env);
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type === "magiclink" ? "magiclink" : "email" });
    if (!error) return Response.redirect(home, 303);
  }
  home.searchParams.set("signin", "expired");
  return Response.redirect(home, 303);
}
