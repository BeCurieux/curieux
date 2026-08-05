// Resolving photo blocks to viewable images.
//
// A photo block stores a memory id, not a URL — the file itself lives in
// private storage and is only ever reachable through a short-lived signed
// link. Every screen that shows a page therefore has to resolve them.
//
// This matters more than it looks: the approval checklist asks the parent to
// confirm "Photos correct", so a preview that shows grey rectangles is asking
// them to approve something they cannot see.

import type { SupabaseClient } from "@supabase/supabase-js";

/** Signed URLs keyed by memory id. Expire quickly; regenerated per request. */
export async function resolvePhotoUrls(
  db: SupabaseClient,
  memoryIds: string[],
  ttlSeconds = 600
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const ids = [...new Set(memoryIds)].filter(Boolean);
  if (ids.length === 0) return out;

  const { data: assets } = await db
    .from("media_assets")
    .select("memory_id, storage_path")
    .in("memory_id", ids);

  for (const asset of assets ?? []) {
    const { data } = await db.storage
      .from("media")
      .createSignedUrl(asset.storage_path, ttlSeconds);
    if (data?.signedUrl) out.set(asset.memory_id, data.signedUrl);
  }
  return out;
}

/** Pull the memory ids out of a set of content blocks. */
export function photoMemoryIds(blocks: { type: string; content: string }[]): string[] {
  return blocks.filter((b) => b.type === "photo").map((b) => b.content);
}
