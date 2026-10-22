import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { serverEnv } from "@/env";
import { adminClient, userClient } from "@/lib/supabase/clients";
import { EXTENSIONS, checkUpload, isOwnedPath, type ImageType } from "./validate";

// Product photos and logos. Local backend: files under EMPIRE_DATA_DIR.
// Supabase: the private `uploads` bucket, written as the user so storage
// policies apply (supabase/migrations/*_storage.sql). Either way the path is
// `<userId>/<uuid>.<ext>`, and reading a file checks the folder is hers.

const localRoot = () => path.resolve(serverEnv().EMPIRE_DATA_DIR, "uploads");

export async function saveUpload(
  userId: string,
  file: File,
): Promise<{ ok: true; path: string } | { ok: false; message: string }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const checked = checkUpload(bytes);
  if (!checked.ok) return checked;
  const key = `${userId}/${randomUUID()}.${EXTENSIONS[checked.type]}`;

  if (serverEnv().EMPIRE_BACKEND === "local") {
    const target = path.join(localRoot(), key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
    return { ok: true, path: key };
  }
  const { error } = await (await userClient()).storage
    .from("uploads")
    .upload(key, bytes, { contentType: checked.type, upsert: false });
  if (error) return { ok: false, message: "That upload didn't work. Try again." };
  return { ok: true, path: key };
}

export async function readUpload(
  userId: string,
  key: string,
): Promise<{ bytes: Uint8Array; type: ImageType } | { redirect: string } | null> {
  if (!isOwnedPath(key, userId)) return null;
  if (serverEnv().EMPIRE_BACKEND === "local") {
    try {
      const bytes = new Uint8Array(await readFile(path.join(localRoot(), key)));
      const checked = checkUpload(bytes);
      return checked.ok ? { bytes, type: checked.type } : null;
    } catch {
      return null;
    }
  }
  const { data } = await (await userClient()).storage.from("uploads").createSignedUrl(key, 300);
  return data?.signedUrl ? { redirect: data.signedUrl } : null;
}

export async function deleteUpload(userId: string, key: string): Promise<void> {
  if (!isOwnedPath(key, userId)) return;
  if (serverEnv().EMPIRE_BACKEND === "local") {
    await rm(path.join(localRoot(), key), { force: true });
    return;
  }
  await (await userClient()).storage.from("uploads").remove([key]);
}

/** Every file she uploaded. Used when she deletes her account. */
export async function deleteAllUploads(userId: string): Promise<void> {
  if (serverEnv().EMPIRE_BACKEND === "local") {
    await rm(path.join(localRoot(), userId), { recursive: true, force: true });
    return;
  }
  const storage = adminClient().storage.from("uploads");
  for (let i = 0; i < 20; i += 1) {
    const { data } = await storage.list(userId, { limit: 100 });
    if (!data || data.length === 0) break;
    await storage.remove(data.map((f) => `${userId}/${f.name}`));
  }
}
