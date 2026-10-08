import { getDeps } from "@/server/deps";
import { handleMe } from "@/server/handlers";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return handleMe(request, getDeps());
}
