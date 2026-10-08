import { supabaseEnv } from "@/server/deps";
import { confirmLink } from "@/server/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const env = supabaseEnv();
  if (!env) return Response.redirect(new URL("/", request.url), 303);
  return confirmLink(request, env);
}
