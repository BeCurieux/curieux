import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { requireUser } from "@/lib/auth/session";
import { repoFor } from "@/lib/data";
import { loadAccess } from "@/lib/generation/run";
import type { Generation } from "@/lib/domain/records";
import type { ModuleKey } from "@/lib/domain/modules";

// Everything a studio page needs, loaded the same way everywhere. An id
// that isn't hers is a 404, never someone else's data.

export const studio = cache(async () => {
  const user = await requireUser();
  const repo = await repoFor(user);
  return { user, repo };
});

export const loadProfile = cache(async (profileId: string) => {
  const { user, repo } = await studio();
  const profile = await repo.getProfile(profileId);
  if (!profile) notFound();
  const access = await loadAccess(repo);
  return { user, repo, profile, ...access };
});

/** The current (latest successful) version of each asset. */
export function currentAssets(generations: Generation[]): Map<string, Generation> {
  const out = new Map<string, Generation>();
  for (const g of generations) {
    if (g.status !== "succeeded") continue;
    const key = assetKey(g.module, g.productId);
    const have = out.get(key);
    if (!have || g.version > have.version) out.set(key, g);
  }
  return out;
}

export const assetKey = (module: ModuleKey, productId: string | null) =>
  `${module}:${productId ?? "-"}`;
