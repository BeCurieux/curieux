import { handleScan } from "@/server/handlers";
import { getDeps } from "@/server/deps";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return handleScan(request, getDeps());
}
