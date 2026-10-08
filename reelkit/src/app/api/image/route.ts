import { getDeps } from "@/server/deps";
import { handleImage } from "@/server/handlers";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return handleImage(request, getDeps());
}
