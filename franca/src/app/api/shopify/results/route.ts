import { handleResults } from "@/server/handlers";
import { getDeps } from "@/server/deps";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return handleResults(request, getDeps());
}
