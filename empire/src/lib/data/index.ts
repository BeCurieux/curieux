import "server-only";
import path from "node:path";
import { serverEnv } from "@/env";
import { adminClient, userClient } from "@/lib/supabase/clients";
import { LocalStore } from "./local";
import type { SystemRepo, UserRepo } from "./repo";
import { SupabaseSystemRepo, SupabaseUserRepo } from "./supabase";

// Picks the backend from EMPIRE_BACKEND. Pages and actions call repoFor()
// with the signed-in user and never touch a client directly.

const globalStores = globalThis as unknown as { __empireStores?: Map<string, LocalStore> };

export function localStore(): LocalStore {
  const file = path.resolve(serverEnv().EMPIRE_DATA_DIR, "empire.json");
  globalStores.__empireStores ??= new Map();
  let store = globalStores.__empireStores.get(file);
  if (!store) {
    store = new LocalStore(file);
    globalStores.__empireStores.set(file, store);
  }
  return store;
}

export async function repoFor(user: { id: string }): Promise<UserRepo> {
  if (serverEnv().EMPIRE_BACKEND === "local") return localStore().forUser(user.id);
  return new SupabaseUserRepo(await userClient(), adminClient, user.id);
}

export function systemRepo(): SystemRepo {
  if (serverEnv().EMPIRE_BACKEND === "local") return localStore().system();
  return new SupabaseSystemRepo(adminClient());
}
