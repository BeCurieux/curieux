// An object store that is a Map.
//
// Two jobs. Demo mode walks the whole product with nothing provisioned, and
// tests exercise the code paths that write and read files without a network.
//
// It is not a fake that always succeeds. Reading a key that was never
// written throws, exactly as both real stores do, because "the file is
// missing" is a case the scanner and the export builder both have to handle
// and a permissive stub is how that handling goes untested.

import { createHash } from "node:crypto";
import { demoPhoto } from "@/lib/supabase/demo";
import type { Bucket, ObjectStore, WriteTicket } from "./provider";

interface StoredObject {
  body: Buffer;
  contentType: string;
}

/**
 * Kept on globalThis rather than in a module variable.
 *
 * Next.js gives server components, route handlers and server actions
 * separate module registries in development, so a plain module-level Map
 * means a file written by an action is missing from the page that reads it —
 * which looks exactly like a storage bug and is not one.
 */
const STORE: Map<string, StoredObject> = ((globalThis as any)[Symbol.for("qotidia.memory-store")] ??=
  new Map());

const at = (bucket: Bucket, key: string) => `${bucket}/${key}`;

export class MemoryStore implements ObjectStore {
  readonly name = "memory";

  async readUrl(
    bucket: Bucket,
    key: string,
    ttlSeconds: number,
    opts?: { downloadAs?: string }
  ): Promise<string> {
    const object = STORE.get(at(bucket, key));

    // Demo mode has no uploads — its photographs are generated. Rather than
    // fail, hand back the same generated photograph the demo client used to
    // serve, so the interface can be walked end to end.
    //
    // It has to be a real generated image and not a coloured rectangle. A
    // grid of flat colour blocks shipped once as a demo camera roll and read
    // as a paint chart rather than as a family's photographs.
    if (!object) return demoPhoto(seedFrom(key));

    const query = opts?.downloadAs ? `&download=${encodeURIComponent(opts.downloadAs)}` : "";
    return `data:${object.contentType};base64,${object.body.toString("base64")}#expires=${ttlSeconds}${query}`;
  }

  async writeTicket(
    bucket: Bucket,
    key: string,
    ttlSeconds: number,
    opts: { contentType: string; contentLength: number }
  ): Promise<WriteTicket> {
    // A URL the browser can actually reach. The store is in this process, so
    // the write has to come back through an endpoint — see
    // app/api/dev-storage/route.ts, which refuses to exist unless this store
    // is the one in use.
    return {
      url: `/api/dev-storage?bucket=${bucket}&key=${encodeURIComponent(key)}&expires=${ttlSeconds}`,
      method: "PUT",
      headers: {
        "content-type": opts.contentType,
        "content-length": String(opts.contentLength),
      },
    };
  }

  async put(bucket: Bucket, key: string, body: Buffer, contentType: string): Promise<void> {
    STORE.set(at(bucket, key), { body: Buffer.from(body), contentType });
  }

  async get(bucket: Bucket, key: string): Promise<Buffer> {
    const object = STORE.get(at(bucket, key));
    if (!object) throw new Error(`could not read ${bucket}/${key}: not found`);
    return object.body;
  }

  async remove(bucket: Bucket, keys: string[]): Promise<void> {
    for (const key of keys) STORE.delete(at(bucket, key));
  }
}

/** Test helper. Nothing in the application may call this. */
export function clearMemoryStore(): void {
  STORE.clear();
}

/**
 * Which generated photograph a key gets.
 *
 * The first number in the path, matching what the demo client did before
 * this existed, so the same fixture shows the same pictures. Falls back to a
 * hash of the key so two different paths without digits do not collapse onto
 * the same image.
 */
function seedFrom(key: string): number {
  const digits = key.match(/(\d+)/)?.[1];
  if (digits) return Number(digits);
  return parseInt(createHash("sha256").update(key).digest("hex").slice(0, 6), 16);
}
