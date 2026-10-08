import { supabaseEnv } from "@/server/deps";
import { verifySignIn } from "@/server/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const env = supabaseEnv();
  if (!env) return Response.json({ error: "Accounts aren't switched on." }, { status: 503 });
  return verifySignIn(request, env);
}
