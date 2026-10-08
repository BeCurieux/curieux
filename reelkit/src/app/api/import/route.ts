import { getDeps } from "@/server/deps";
import { handleImport } from "@/server/handlers";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return handleImport(request, getDeps());
}
