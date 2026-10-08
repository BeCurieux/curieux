import { getDeps } from "@/server/deps";
import { handleWrite } from "@/server/handlers";

export const dynamic = "force-dynamic";
// A model draft takes a few seconds; the default limit on some plans is ten.
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  return handleWrite(request, getDeps());
}
