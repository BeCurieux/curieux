import "server-only";
import { timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/env";

// Vercel's scheduled jobs (vercel.json crons) send CRON_SECRET as a bearer
// token. Without the secret set, no request is accepted.
export function isCronRequest(request: Request): boolean {
  const secret = serverEnv().CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  return (
    !!secret &&
    given.length === secret.length &&
    timingSafeEqual(Buffer.from(given), Buffer.from(secret))
  );
}
