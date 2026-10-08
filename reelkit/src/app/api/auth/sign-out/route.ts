import { supabaseEnv } from "@/server/deps";
import { signOut } from "@/server/auth";

export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  const env = supabaseEnv();
  if (!env) return Response.json({ signedOut: true });
  return signOut(env);
}
