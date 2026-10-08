import { getDeps } from "@/server/deps";
import { handleCheckout } from "@/server/handlers";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return handleCheckout(request, getDeps());
}
