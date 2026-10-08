import { getDeps } from "@/server/deps";
import { handleWebhook } from "@/server/handlers";

export const dynamic = "force-dynamic";

// Stripe signs the exact bytes it sent; the handler reads the body as text
// and verifies before parsing.
export async function POST(request: Request): Promise<Response> {
  return handleWebhook(request, getDeps());
}
