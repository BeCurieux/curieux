import "server-only";
import { parseServerEnv, type ServerEnv } from "@/env";

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  cached ??= parseServerEnv({ SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY });
  return cached;
}
