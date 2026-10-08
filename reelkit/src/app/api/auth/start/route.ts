import { getDeps, supabaseEnv } from "@/server/deps";
import { startSignIn } from "@/server/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const env = supabaseEnv();
  if (!env) return Response.json({ error: "Accounts aren't switched on." }, { status: 503 });
  return startSignIn(request, env, getDeps().appUrl ?? new URL(request.url).origin);
}
